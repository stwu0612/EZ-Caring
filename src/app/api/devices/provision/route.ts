import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const AWS_IOT_ENDPOINT = process.env.AWS_IOT_ENDPOINT || 'a2ayumhjq0g3lh-ats.iot.ap-northeast-1.amazonaws.com'
const AWS_REGION = process.env.AWS_REGION || 'ap-northeast-1'
const TEMPLATE_NAME = process.env.AWS_IOT_TEMPLATE_NAME || 'EZCaringDeviceTemplate'
const CLAIM_CERT_PEM = process.env.AWS_IOT_CLAIM_CERT || ''
const CLAIM_PRIVATE_KEY = process.env.AWS_IOT_CLAIM_KEY || ''

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const { deviceId } = await request.json()
    if (!deviceId) {
      return NextResponse.json({ error: 'deviceId required' }, { status: 400 })
    }

    if (!CLAIM_CERT_PEM || !CLAIM_PRIVATE_KEY) {
      return NextResponse.json({ error: 'Claim certificate not configured' }, { status: 500 })
    }

    const { data: member } = await supabase
      .from('members')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()

    if (member) {
      await supabase.from('devices').upsert({
        device_id: deviceId,
        member_id: member.id,
        status: 'pending',
        updated_at: new Date().toISOString()
      }, { onConflict: 'device_id' })
    }

    return NextResponse.json({
      success: true,
      provisionToken: `provision-${Date.now()}`,
      iotEndpoint: AWS_IOT_ENDPOINT,
      iotRegion: AWS_REGION,
      templateName: TEMPLATE_NAME,
      claimCertPem: CLAIM_CERT_PEM,
      claimPrivateKey: CLAIM_PRIVATE_KEY,
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      deviceId
    })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
