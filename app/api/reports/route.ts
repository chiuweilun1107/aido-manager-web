import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getReport } from '@/lib/self-service'

export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const svc = createServiceClient()
  const { data: aiDoUser } = await svc.schema('aido').from('users').select('id, company_id, primary_role_id').eq('auth_user_id', user.id).single()
  if (!aiDoUser) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(await getReport(svc, aiDoUser))
}
