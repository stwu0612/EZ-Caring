import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

/**
 * 同步受測者 API
 * 
 * POST /api/sync/subjects
 * 
 * Body:
 * {
 *   "device_id": "px-device-001",
 *   "subjects": [
 *     {
 *       "ulid": "01HQXXX...",
 *       "name": "王小明",
 *       "id_number": "A123456789",
 *       "gender": "male",
 *       "birth_date": "1990-01-01",
 *       "age": 34,
 *       "height": 175.5,
 *       "weight": 70.0
 *     }
 *   ]
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { device_id, subjects } = body

    if (!subjects || !Array.isArray(subjects)) {
      return NextResponse.json(
        { success: false, error: '無效的請求格式' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()
    const syncedSubjects = []
    const errors = []

    for (const subject of subjects) {
      try {
        // Upsert 受測者
        const { data, error } = await supabase
          .from('subjects')
          .upsert({
            ulid: subject.ulid,
            name: subject.name,
            id_number: subject.id_number,
            gender: subject.gender,
            birth_date: subject.birth_date,
            age: subject.age,
            height: subject.height,
            weight: subject.weight,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'ulid'
          })
          .select()
          .single()

        if (error) {
          errors.push({ ulid: subject.ulid, error: error.message })
        } else {
          syncedSubjects.push(data)
        }
      } catch (err) {
        errors.push({ ulid: subject.ulid, error: String(err) })
      }
    }

    // 記錄同步日誌
    await supabase.from('sync_logs').insert({
      source: 'android_app',
      device_id,
      sync_type: 'subjects',
      records_synced: syncedSubjects.length,
      status: errors.length === 0 ? 'success' : errors.length < subjects.length ? 'partial' : 'failed',
      error_message: errors.length > 0 ? JSON.stringify(errors) : null
    })

    return NextResponse.json({
      success: true,
      synced: syncedSubjects.length,
      total: subjects.length,
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
 * 取得受測者列表
 * 
 * GET /api/sync/subjects?since=2024-01-01
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const since = searchParams.get('since')
    const limit = parseInt(searchParams.get('limit') || '100')

    const supabase = createAdminClient()

    let query = supabase
      .from('subjects')
      .select('*')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(limit)

    if (since) {
      query = query.gte('updated_at', since)
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
    console.error('Get subjects error:', error)
    return NextResponse.json(
      { success: false, error: '取得資料失敗' },
      { status: 500 }
    )
  }
}
