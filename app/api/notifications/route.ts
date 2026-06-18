import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: aiDoUser } = await svc.schema('aido').from('users').select('id').eq('auth_user_id', user.id).single()
  if (!aiDoUser) return NextResponse.json({ notifications: [] })

  const { data } = await svc.schema('aido').from('notifications')
    .select('*').eq('user_id', aiDoUser.id).order('created_at', { ascending: false }).limit(50)

  return NextResponse.json({ notifications: data || [] })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: aiDoUser } = await svc.schema('aido').from('users').select('id').eq('auth_user_id', user.id).single()
  if (!aiDoUser) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { ids } = await req.json()
  if (ids && Array.isArray(ids)) {
    await svc.schema('aido').from('notifications').update({ read_at: new Date().toISOString() })
      .in('id', ids).eq('user_id', aiDoUser.id)
  } else {
    await svc.schema('aido').from('notifications').update({ read_at: new Date().toISOString() })
      .eq('user_id', aiDoUser.id).is('read_at', null)
  }
  return NextResponse.json({ ok: true })
}
