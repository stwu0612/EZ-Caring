import { NextRequest, NextResponse } from 'next/server'
import { KinesisVideoClient, GetDataEndpointCommand } from '@aws-sdk/client-kinesis-video'
import { KinesisVideoArchivedMediaClient, GetHLSStreamingSessionURLCommand } from '@aws-sdk/client-kinesis-video-archived-media'

const REGION = process.env.AWS_REGION || 'ap-northeast-1'

export async function POST(request: NextRequest) {
  try {
    const { streamName, startTime, endTime } = await request.json()

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

    // 設定時間範圍（如果有提供）
    const hlsParams: any = {
      StreamName: streamName,
      PlaybackMode: 'ON_DEMAND',
      HLSFragmentSelector: {
        FragmentSelectorType: 'PRODUCER_TIMESTAMP',
      },
      ContainerFormat: 'FRAGMENTED_MP4',
      DiscontinuityMode: 'ALWAYS',
      DisplayFragmentTimestamp: 'ALWAYS',
      MaxMediaPlaylistFragmentResults: 5000,
      Expires: 3600, // 1 小時有效
    }

    // 如果有指定時間範圍
    if (startTime && endTime) {
      hlsParams.HLSFragmentSelector.TimestampRange = {
        StartTimestamp: new Date(startTime),
        EndTimestamp: new Date(endTime),
      }
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
