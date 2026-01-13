import { NextRequest, NextResponse } from 'next/server'

const REGION = process.env.AWS_REGION || 'ap-northeast-1'
const BUCKET_NAME = process.env.AWS_S3_VIDEO_BUCKET || 'ezcaring-px2-videos'

export async function POST(request: NextRequest) {
  try {
    const { videoS3Key, videoS3Url } = await request.json()

    // 如果前端傳來完整的 S3 URL，先解析出 key
    let s3Key = videoS3Key
    let bucketName = BUCKET_NAME
    
    if (!s3Key && videoS3Url) {
      // 從 S3 URL 提取 bucket 和 key
      // 格式: s3://bucket-name/path/to/video.mp4
      try {
        if (videoS3Url.startsWith('s3://')) {
          const withoutProtocol = videoS3Url.replace('s3://', '')
          const slashIndex = withoutProtocol.indexOf('/')
          bucketName = withoutProtocol.substring(0, slashIndex)
          s3Key = withoutProtocol.substring(slashIndex + 1)
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

    // 直接產生公開 URL（因為 bucket 已設為 public-read）
    const publicUrl = `https://${bucketName}.s3.${REGION}.amazonaws.com/${s3Key}`

    console.log('S3 Video Request:', {
      bucket: bucketName,
      key: s3Key,
      publicUrl: publicUrl,
    })

    return NextResponse.json({
      success: true,
      videoUrl: publicUrl,
      debug: {
        bucket: bucketName,
        key: s3Key,
      }
    })

  } catch (error: any) {
    console.error('S3 Video Error:', error)
    
    return NextResponse.json(
      { success: false, error: error.message || '取得影片 URL 失敗' },
      { status: 500 }
    )
  }
}
