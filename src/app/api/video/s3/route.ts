import { NextRequest, NextResponse } from 'next/server'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const REGION = process.env.AWS_REGION || 'ap-northeast-1'
const BUCKET_NAME = process.env.AWS_S3_VIDEO_BUCKET || 'px-test-videos'

export async function POST(request: NextRequest) {
  try {
    const { videoS3Key, videoS3Url } = await request.json()

    // 檢查環境變數
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      return NextResponse.json(
        { success: false, error: 'AWS credentials 未設定' },
        { status: 500 }
      )
    }

    // 如果前端傳來完整的 S3 URL，先解析出 key
    let s3Key = videoS3Key
    
    if (!s3Key && videoS3Url) {
      // 從 S3 URL 提取 key
      // 格式: https://bucket-name.s3.region.amazonaws.com/path/to/video.mp4
      // 或: s3://bucket-name/path/to/video.mp4
      try {
        if (videoS3Url.startsWith('s3://')) {
          s3Key = videoS3Url.replace(/^s3:\/\/[^/]+\//, '')
        } else {
          const url = new URL(videoS3Url)
          s3Key = url.pathname.substring(1) // 移除開頭的 /
        }
      } catch (e) {
        return NextResponse.json(
          { success: false, error: '無效的 S3 URL 格式' },
          { status: 400 }
        )
      }
    }

    if (!s3Key) {
      return NextResponse.json(
        { success: false, error: '缺少 videoS3Key 或 videoS3Url 參數' },
        { status: 400 }
      )
    }

    const credentials = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    }

    const s3Client = new S3Client({
      region: REGION,
      credentials,
    })

    // 產生 presigned URL（有效期 1 小時）
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
    })

    const presignedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 3600, // 1 小時
    })

    console.log('S3 Video Request:', {
      bucket: BUCKET_NAME,
      key: s3Key,
      presignedUrlGenerated: true,
    })

    return NextResponse.json({
      success: true,
      videoUrl: presignedUrl,
      debug: {
        bucket: BUCKET_NAME,
        key: s3Key,
      }
    })

  } catch (error: any) {
    console.error('S3 Video Error:', error)
    
    let errorMessage = '取得影片 URL 失敗'
    if (error.name === 'NoSuchKey') {
      errorMessage = '找不到影片檔案'
    } else if (error.name === 'AccessDenied') {
      errorMessage = 'AWS 權限不足'
    } else if (error.message) {
      errorMessage = error.message
    }

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}
