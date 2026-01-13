import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3'

const REGION = process.env.AWS_REGION || 'ap-northeast-1'
const BUCKET_NAME = process.env.AWS_S3_VIDEO_BUCKET || 'ezcaring-px2-videos'

// Supabase service client (需要 service role key 才能繞過 RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface S3VideoFile {
  key: string
  deviceId: string
  testType: string
  recordingTime: Date
  s3Url: string
}

// 解析 S3 檔名，提取 device_id, test_type, 時間
function parseS3Key(key: string): S3VideoFile | null {
  // 格式: recordings/px-device-001/2026/01/13/px-device-001_balance_foot_20260113_102123.mp4
  // 或:   recordings/px-device-001/px-device-001_sit_stand_20260107_142106.mp4
  
  const filename = key.split('/').pop()
  if (!filename || !filename.endsWith('.mp4')) return null
  
  // 解析檔名: px-device-001_balance_foot_20260113_102123.mp4
  const match = filename.match(/^(.+?)_(.+?)_(\d{8})_(\d{6})\.mp4$/)
  if (!match) return null
  
  const [, deviceId, testType, dateStr, timeStr] = match
  
  // 解析時間: 20260113_102123 -> 2026-01-13 10:21:23
  const year = parseInt(dateStr.substring(0, 4))
  const month = parseInt(dateStr.substring(4, 6)) - 1
  const day = parseInt(dateStr.substring(6, 8))
  const hour = parseInt(timeStr.substring(0, 2))
  const minute = parseInt(timeStr.substring(2, 4))
  const second = parseInt(timeStr.substring(4, 6))
  
  const recordingTime = new Date(year, month, day, hour, minute, second)
  
  return {
    key,
    deviceId,
    testType,
    recordingTime,
    s3Url: `s3://${BUCKET_NAME}/${key}`
  }
}

// GET: 執行同步（可以用 cron job 呼叫）
export async function GET(request: NextRequest) {
  try {
    // 檢查 API Key（簡單保護，可選）
    const authHeader = request.headers.get('authorization')
    const apiKey = process.env.SYNC_API_KEY
    if (apiKey && authHeader !== `Bearer ${apiKey}`) {
      // 如果設定了 API Key 但不匹配，允許但記錄警告
      console.warn('S3 Video Sync: No valid API key provided')
    }

    // 檢查 AWS 憑證
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      return NextResponse.json(
        { success: false, error: 'AWS credentials 未設定' },
        { status: 500 }
      )
    }

    const s3Client = new S3Client({
      region: REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    })

    // 1. 列出 S3 所有影片
    const s3Files: S3VideoFile[] = []
    let continuationToken: string | undefined

    do {
      const command = new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        Prefix: 'recordings/',
        ContinuationToken: continuationToken,
      })

      const response = await s3Client.send(command)
      
      for (const obj of response.Contents || []) {
        if (obj.Key) {
          const parsed = parseS3Key(obj.Key)
          if (parsed) {
            s3Files.push(parsed)
          }
        }
      }

      continuationToken = response.NextContinuationToken
    } while (continuationToken)

    console.log(`Found ${s3Files.length} video files in S3`)

    // 2. 取得所有沒有 video_s3_url 的測試結果
    const { data: results, error: fetchError } = await supabaseAdmin
      .from('test_results')
      .select('id, device_id, test_type, tested_at')
      .is('video_s3_url', null)
      .order('tested_at', { ascending: false })

    if (fetchError) {
      console.error('Fetch results error:', fetchError)
      return NextResponse.json(
        { success: false, error: fetchError.message },
        { status: 500 }
      )
    }

    console.log(`Found ${results?.length || 0} results without video_s3_url`)

    // 3. 配對邏輯：找最接近的影片（同 device_id + test_type，時間差最小）
    const updates: { id: string; video_s3_url: string; timeDiff: number }[] = []
    const usedS3Files = new Set<string>()

    for (const result of results || []) {
      const testedAt = new Date(result.tested_at)
      
      // 找同 device_id + test_type 的影片
      const candidates = s3Files.filter(f => 
        f.deviceId === result.device_id && 
        f.testType === result.test_type &&
        !usedS3Files.has(f.key)
      )

      if (candidates.length === 0) continue

      // 找時間差最小的（錄影開始時間應該在 tested_at 之前，且差距在 5 分鐘內）
      let bestMatch: S3VideoFile | null = null
      let minDiff = Infinity

      for (const candidate of candidates) {
        // 錄影開始時間應該早於或等於測試完成時間
        const diff = Math.abs(testedAt.getTime() - candidate.recordingTime.getTime())
        
        // 只接受 5 分鐘內的差距
        if (diff < 5 * 60 * 1000 && diff < minDiff) {
          minDiff = diff
          bestMatch = candidate
        }
      }

      if (bestMatch) {
        updates.push({
          id: result.id,
          video_s3_url: bestMatch.s3Url,
          timeDiff: minDiff / 1000
        })
        usedS3Files.add(bestMatch.key)
      }
    }

    console.log(`Matched ${updates.length} videos`)

    // 4. 批次更新資料庫
    let updatedCount = 0
    const errors: string[] = []

    for (const update of updates) {
      const { error: updateError } = await supabaseAdmin
        .from('test_results')
        .update({ video_s3_url: update.video_s3_url })
        .eq('id', update.id)

      if (updateError) {
        errors.push(`Failed to update ${update.id}: ${updateError.message}`)
      } else {
        updatedCount++
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        s3FilesFound: s3Files.length,
        resultsWithoutVideo: results?.length || 0,
        matched: updates.length,
        updated: updatedCount,
        errors: errors.length
      },
      updates: updates.map(u => ({
        id: u.id,
        video_s3_url: u.video_s3_url,
        timeDiffSeconds: u.timeDiff
      })),
      errors: errors.length > 0 ? errors : undefined
    })

  } catch (error: any) {
    console.error('S3 Video Sync Error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// POST: 手動指定配對（管理員用）
export async function POST(request: NextRequest) {
  try {
    const { resultId, videoS3Url } = await request.json()

    if (!resultId || !videoS3Url) {
      return NextResponse.json(
        { success: false, error: '缺少 resultId 或 videoS3Url' },
        { status: 400 }
      )
    }

    const { error } = await supabaseAdmin
      .from('test_results')
      .update({ video_s3_url: videoS3Url })
      .eq('id', resultId)

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })

  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
