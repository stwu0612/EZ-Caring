import { NextRequest, NextResponse } from 'next/server'
import { KinesisVideoClient, GetDataEndpointCommand } from '@aws-sdk/client-kinesis-video'
import { KinesisVideoArchivedMediaClient, GetHLSStreamingSessionURLCommand } from '@aws-sdk/client-kinesis-video-archived-media'

const REGION = process.env.AWS_REGION || 'ap-northeast-1'

export async function POST(request: NextRequest) {
  try {
    const { streamName, startTime, endTime, testedAt } = await request.json()

    if (!streamName) {
      return NextResponse.json(
        { success: false, error: '缺少 streamName 參數' },
        { status: 400 }
      )
    }

    // 檢查環境變數
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

    // 1. 取得 Data Endpoint
    const kvsClient = new KinesisVideoClient({
      region: REGION,
      credentials,
    })

    const getEndpointCommand = new GetDataEndpointCommand({
      StreamName: streamName,
      APIName: 'GET_HLS_STREAMING_SESSION_URL',
    })

    const endpointResponse = await kvsClient.send(getEndpointCommand)
    const dataEndpoint = endpointResponse.DataEndpoint

    if (!dataEndpoint) {
      return NextResponse.json(
        { success: false, error: '無法取得 Data Endpoint' },
        { status: 500 }
      )
    }

    // 2. 取得 HLS URL
    const archivedMediaClient = new KinesisVideoArchivedMediaClient({
      region: REGION,
      credentials,
      endpoint: dataEndpoint,
    })

    // 計算時間範圍
    let hlsStartTime: Date
    let hlsEndTime: Date

    if (startTime && endTime) {
      // 有明確的開始和結束時間
      hlsStartTime = new Date(startTime)
      hlsEndTime = new Date(endTime)
    } else if (testedAt) {
      // 根據測試時間估算（測試前 2 分鐘到測試後 5 分鐘）
      const testTime = new Date(testedAt)
      hlsStartTime = new Date(testTime.getTime() - 2 * 60 * 1000) // 2 分鐘前
      hlsEndTime = new Date(testTime.getTime() + 5 * 60 * 1000) // 5 分鐘後
    } else {
      // 從串流名稱中提取時間戳（exam-1766572119961 格式）
      const match = streamName.match(/exam-(\d+)/)
      if (match) {
        const timestamp = parseInt(match[1])
        hlsStartTime = new Date(timestamp - 2 * 60 * 1000) // 2 分鐘前
        hlsEndTime = new Date(timestamp + 5 * 60 * 1000) // 5 分鐘後
      } else {
        // 最後手段：使用最近 10 分鐘
        hlsEndTime = new Date()
        hlsStartTime = new Date(hlsEndTime.getTime() - 10 * 60 * 1000)
      }
    }

    console.log('HLS Request:', {
      streamName,
      startTime: hlsStartTime.toISOString(),
      endTime: hlsEndTime.toISOString(),
    })

    // 使用 LIVE_REPLAY 模式（更可靠）
    const hlsParams = {
      StreamName: streamName,
      PlaybackMode: 'LIVE_REPLAY' as const,
      HLSFragmentSelector: {
        FragmentSelectorType: 'SERVER_TIMESTAMP' as const,
        TimestampRange: {
          StartTimestamp: hlsStartTime,
          EndTimestamp: hlsEndTime,
        },
      },
      ContainerFormat: 'FRAGMENTED_MP4' as const,
      DiscontinuityMode: 'ALWAYS' as const,
      DisplayFragmentTimestamp: 'NEVER' as const,
      MaxMediaPlaylistFragmentResults: 5000,
      Expires: 3600, // 1 小時有效
    }

    const getHLSCommand = new GetHLSStreamingSessionURLCommand(hlsParams)
    const hlsResponse = await archivedMediaClient.send(getHLSCommand)

    if (!hlsResponse.HLSStreamingSessionURL) {
      return NextResponse.json(
        { success: false, error: '無法取得 HLS URL' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      hlsUrl: hlsResponse.HLSStreamingSessionURL,
      debug: {
        startTime: hlsStartTime.toISOString(),
        endTime: hlsEndTime.toISOString(),
      }
    })

  } catch (error: any) {
    console.error('KVS HLS Error:', error)
    
    // 處理常見錯誤
    let errorMessage = '取得 HLS URL 失敗'
    if (error.name === 'ResourceNotFoundException') {
      errorMessage = '找不到此串流，可能已過期或名稱錯誤'
    } else if (error.name === 'AccessDeniedException') {
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
