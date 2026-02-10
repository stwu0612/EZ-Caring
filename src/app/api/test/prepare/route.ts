import { NextRequest, NextResponse } from 'next/server'
import {
  KinesisVideoClient,
  DescribeSignalingChannelCommand,
  GetSignalingChannelEndpointCommand,
  CreateSignalingChannelCommand,
  ChannelProtocol,
  ChannelRole,
} from '@aws-sdk/client-kinesis-video'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const REGION = process.env.AWS_REGION || 'ap-northeast-1'
const S3_BUCKET = process.env.AWS_S3_VIDEO_BUCKET || 'ezcaring-px2-videos'

/**
 * POST /api/test/prepare
 * 
 * App 進入測試前呼叫，後端準備 WebRTC 和 S3 資源
 * 
 * Request:
 * {
 *   "device_id": "ez-caring-PX-001",
 *   "test_type": "sit_stand"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "webrtc_channel_arn": "arn:aws:kinesisvideo:...",
 *   "webrtc_credentials": {
 *     "region": "ap-northeast-1",
 *     "channel_name": "ez-caring-PX-001-webrtc",
 *     "wss_endpoint": "wss://...",
 *     "https_endpoint": "https://...",
 *     "ice_servers": [
 *       { "urls": "stun:stun.kinesisvideo.ap-northeast-1.amazonaws.com:443" },
 *       { "urls": "turn:...", "username": "...", "credential": "..." }
 *     ]
 *   },
 *   "s3_upload_url": "https://...presigned...",
 *   "s3_video_key": "videos/ez-caring-PX-001/sit_stand/2026-02-11T..."
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const { device_id, test_type } = await request.json()

    if (!device_id || !test_type) {
      return NextResponse.json(
        { success: false, error: '缺少 device_id 或 test_type 參數' },
        { status: 400 }
      )
    }

    // 檢查 AWS credentials
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      return NextResponse.json(
        { success: false, error: 'AWS credentials 未設定' },
        { status: 500 }
      )
    }

    const credentials = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    }

    const channelName = `${device_id}-webrtc`
    const now = new Date()
    const dateStr = now.toISOString().replace(/[:.]/g, '-')
    const s3VideoKey = `videos/${device_id}/${test_type}/${dateStr}.mp4`

    console.log('Test Prepare:', { device_id, test_type, channelName, s3VideoKey })

    // ============================================================
    // 1. WebRTC: 確保 Signaling Channel 存在並取得資訊
    // ============================================================
    const kvsClient = new KinesisVideoClient({ region: REGION, credentials })

    let channelArn = ''

    // 嘗試取得現有 channel
    try {
      const describeRes = await kvsClient.send(
        new DescribeSignalingChannelCommand({ ChannelName: channelName })
      )
      channelArn = describeRes.ChannelInfo?.ChannelARN || ''
    } catch (err: any) {
      if (err.name === 'ResourceNotFoundException') {
        // Channel 不存在，建立新的
        const createRes = await kvsClient.send(
          new CreateSignalingChannelCommand({
            ChannelName: channelName,
            ChannelType: 'SINGLE_MASTER',
          })
        )
        channelArn = createRes.ChannelARN || ''
        console.log('Created new channel:', channelName)
      } else {
        throw err
      }
    }

    if (!channelArn) {
      return NextResponse.json(
        { success: false, error: '無法取得 Signaling Channel ARN' },
        { status: 500 }
      )
    }

    // 取得 Signaling Endpoints (WSS + HTTPS)
    const endpointRes = await kvsClient.send(
      new GetSignalingChannelEndpointCommand({
        ChannelARN: channelArn,
        SingleMasterChannelEndpointConfiguration: {
          Protocols: [ChannelProtocol.WSS, ChannelProtocol.HTTPS],
          Role: ChannelRole.VIEWER,
        },
      })
    )

    const endpoints = endpointRes.ResourceEndpointList || []
    const wssEndpoint = endpoints.find(e => e.Protocol === 'WSS')?.ResourceEndpoint || ''
    const httpsEndpoint = endpoints.find(e => e.Protocol === 'HTTPS')?.ResourceEndpoint || ''

    // 建構 ICE servers
    // STUN server（免費，AWS 提供）
    const iceServers: Array<{ urls: string; username?: string; credential?: string }> = [
      { urls: `stun:stun.kinesisvideo.${REGION}.amazonaws.com:443` },
    ]

    // 嘗試取得 TURN credentials（需要 @aws-sdk/client-kinesis-video-signaling）
    // 如果沒安裝 signaling SDK，就只用 STUN
    try {
      const { KinesisVideoSignalingClient, GetIceServerConfigCommand } =
        await import('@aws-sdk/client-kinesis-video-signaling')

      const signalingClient = new KinesisVideoSignalingClient({
        region: REGION,
        credentials,
        endpoint: httpsEndpoint,
      })

      const iceRes = await signalingClient.send(
        new GetIceServerConfigCommand({
          ChannelARN: channelArn,
        })
      )

      if (iceRes.IceServerList) {
        for (const server of iceRes.IceServerList) {
          if (server.Uris) {
            for (const uri of server.Uris) {
              iceServers.push({
                urls: uri,
                username: server.Username || '',
                credential: server.Password || '',
              })
            }
          }
        }
      }
    } catch (sigErr: any) {
      console.warn('TURN credentials not available (signaling SDK missing?), using STUN only:', sigErr.message)
    }

    // ============================================================
    // 2. S3: 產生 Presigned Upload URL
    // ============================================================
    const s3Client = new S3Client({ region: REGION, credentials })

    const putCmd = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3VideoKey,
      ContentType: 'video/mp4',
    })

    const s3UploadUrl = await getSignedUrl(s3Client, putCmd, {
      expiresIn: 1800, // 30 分鐘有效
    })

    // ============================================================
    // 回傳結果
    // ============================================================
    return NextResponse.json({
      success: true,
      webrtc_channel_arn: channelArn,
      webrtc_credentials: {
        region: REGION,
        channel_name: channelName,
        wss_endpoint: wssEndpoint,
        https_endpoint: httpsEndpoint,
        ice_servers: iceServers,
      },
      s3_upload_url: s3UploadUrl,
      s3_video_key: s3VideoKey,
    })

  } catch (error: any) {
    console.error('Test Prepare Error:', error)

    let errorMessage = '準備測試資源失敗'
    if (error.name === 'AccessDeniedException') {
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
