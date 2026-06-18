import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: aiDoUser } = await svc.schema('aido').from('users').select('*').eq('auth_user_id', user.id).single()
  if (!aiDoUser) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const db = svc.schema('aido')

  const roleArm = aiDoUser.primary_role_id ? `,approver_role_id.eq.${aiDoUser.primary_role_id}` : ''
  const [{ data: pendingSteps }, { data: myRequests }] = await Promise.all([
    db.from('approval_steps').select('request_id, requests!inner(id, request_no, module_code, title, status, created_at, submitted_at, requester_user_id, users!requests_requester_user_id_fkey(display_name))')
      .eq('status', 'active')
      .or(`approver_user_id.eq.${aiDoUser.id}${roleArm}`),
    db.from('requests').select('id, request_no, module_code, title, status, created_at, submitted_at')
      .eq('requester_user_id', aiDoUser.id)
      .not('status', 'eq', 'draft')
      .order('created_at', { ascending: false })
      .limit(30)
  ])

  const uniquePending = Array.from(
    new Map((pendingSteps || []).map(s => [s.request_id, s.requests])).values()
  ).filter(Boolean)

  return NextResponse.json({ pending: uniquePending, my_requests: myRequests || [] })
}
