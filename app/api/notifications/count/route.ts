import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ count: 0 })

  const svc = createServiceClient()
  const { data: aiDoUser } = await svc.schema('aido').from('users').select('id').eq('auth_user_id', user.id).single()
  if (!aiDoUser) return NextResponse.json({ count: 0 })

  const { count } = await svc.schema('aido').from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', aiDoUser.id)
    .is('read_at', null)

  return NextResponse.json({ count: count || 0 })
}
