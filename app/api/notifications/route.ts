import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { listNotifications, markNotificationsRead } from '@/lib/self-service'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: aiDoUser } = await svc.schema('aido').from('users').select('id').eq('auth_user_id', user.id).single()
  if (!aiDoUser) return NextResponse.json({ notifications: [] })

  return NextResponse.json({ notifications: await listNotifications(svc, aiDoUser) })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: aiDoUser } = await svc.schema('aido').from('users').select('id').eq('auth_user_id', user.id).single()
  if (!aiDoUser) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { ids } = await req.json()
  await markNotificationsRead(svc, aiDoUser, ids)
  return NextResponse.json({ ok: true })
}
