import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

/**
 * 同步測試結果 API
 * 
 * POST /api/sync/results
 * 
 * Body:
 * {
 *   "device_id": "px-device-001",
 *   "results": [
 *     {
 *       "ulid": "01HQXXX...",
 *       "subject_ulid": "01HQYYY...",
 *       "test_type": "sit_stand",
 *       "test_name": "椅子坐站測試",
 *       "result_value": 12.5,
 *       "result_unit": "秒",
 *       "hls_stream_name": "exam-123456",
 *       "hls_start_time": "2024-01-01T10:00:00Z",
 *       "hls_end_time": "2024-01-01T10:01:00Z",
 *       "tested_at": "2024-01-01T10:00:30Z"
 *     }
 *   ]
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { device_id, results } = body

    if (!results || !Array.isArray(results)) {
      return NextResponse.json(
        { success: false, error: '無效的請求格式' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()
    const syncedResults = []
    const errors = []

    for (const result of results) {
      try {
        // 查找 subject
        let subjectId = null
        if (result.subject_ulid) {
          const { data: subject } = await supabase
            .from('subjects')
            .select('id')
            .eq('ulid', result.subject_ulid)
            .single()
          
          subjectId = subject?.id
        }

        // Upsert 測試結果
        const { data, error } = await supabase
          .from('test_results')
          .upsert({
            ulid: result.ulid,
            subject_id: subjectId,
            subject_ulid: result.subject_ulid,
            test_type: result.test_type,
            test_name: result.test_name,
            result_value: result.result_value,
            result_unit: result.result_unit,
            hls_stream_name: result.hls_stream_name,
            hls_start_time: result.hls_start_time,
            hls_end_time: result.hls_end_time,
            device_id: device_id || result.device_id,
            tested_at: result.tested_at,
            synced_at: new Date().toISOString(),
            raw_data: result
          }, {
            onConflict: 'ulid'
          })
          .select()
          .single()

        if (error) {
          errors.push({ ulid: result.ulid, error: error.message })
        } else {
          syncedResults.push(data)
        }
      } catch (err) {
        errors.push({ ulid: result.ulid, error: String(err) })
      }
    }

    // 記錄同步日誌
    await supabase.from('sync_logs').insert({
      source: 'android_app',
      device_id,
      sync_type: 'test_results',
      records_synced: syncedResults.length,
      status: errors.length === 0 ? 'success' : errors.length < results.length ? 'partial' : 'failed',
      error_message: errors.length > 0 ? JSON.stringify(errors) : null
    })

    return NextResponse.json({
      success: true,
      synced: syncedResults.length,
      total: results.length,
      errors: errors.length > 0 ? errors : undefined
    })

  } catch (error) {
    console.error('Sync error:', error)
    return NextResponse.json(
      { success: false, error: '同步失敗' },
      { status: 500 }
    )
  }
}

/**
 * 取得測試結果
 * 
 * GET /api/sync/results?subject_ulid=xxx&since=2024-01-01
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const subjectUlid = searchParams.get('subject_ulid')
    const since = searchParams.get('since')
    const limit = parseInt(searchParams.get('limit') || '100')

    const supabase = createAdminClient()

    let query = supabase
      .from('test_results')
      .select('*')
      .order('tested_at', { ascending: false })
      .limit(limit)

    if (subjectUlid) {
      query = query.eq('subject_ulid', subjectUlid)
    }

    if (since) {
      query = query.gte('synced_at', since)
    }

    const { data, error } = await query

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      data,
      count: data?.length || 0
    })

  } catch (error) {
    console.error('Get results error:', error)
    return NextResponse.json(
      { success: false, error: '取得資料失敗' },
      { status: 500 }
    )
  }
}
