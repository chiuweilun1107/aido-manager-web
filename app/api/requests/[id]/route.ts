import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getRequestDetail } from '@/lib/self-service'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: aiDoUser } = await svc.schema('aido').from('users').select('*').eq('auth_user_id', user.id).single()
  if (!aiDoUser) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const r = await getRequestDetail(svc, aiDoUser, Number(id))
  if (!r.ok) {
    if (r.error === 'notfound') return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return NextResponse.json(r.data)
}
