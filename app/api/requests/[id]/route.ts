import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const db = svc.schema('aido')
  const { data: aiDoUser } = await db.from('users').select('*').eq('auth_user_id', user.id).single()
  if (!aiDoUser) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: request } = await db.from('requests').select('*, users!requests_requester_user_id_fkey(id,display_name,email)').eq('id', Number(id)).single()
  if (!request) return NextResponse.json({ error: 'Request not found' }, { status: 404 })

  const { data: aiDoRole } = await db.from('roles').select('code').eq('id', aiDoUser.primary_role_id).single()
  const roleCode = aiDoRole?.code ?? 'employee'
  const privilegedRoles = ['hr', 'executive', 'auditor', 'admin_officer']

  if (request.requester_user_id !== aiDoUser.id && !privilegedRoles.includes(roleCode)) {
    const roleArm = aiDoUser.primary_role_id ? `,approver_role_id.eq.${aiDoUser.primary_role_id}` : ''
    const { data: approverStep } = await db.from('approval_steps').select('id')
      .eq('request_id', Number(id))
      .or(`approver_user_id.eq.${aiDoUser.id}${roleArm}`)
      .limit(1).maybeSingle()
    if (!approverStep) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [{ data: steps }, { data: actions }] = await Promise.all([
    db.from('approval_steps').select('*, users!approval_steps_approver_user_id_fkey(id,display_name), roles!approval_steps_approver_role_id_fkey(name)').eq('request_id', Number(id)).order('step_no'),
    db.from('approval_actions').select('*, users!approval_actions_actor_user_id_fkey(id,display_name)').eq('request_id', Number(id)).order('created_at')
  ])

  const payload = request.payload_json ? JSON.parse(request.payload_json) : {}
  return NextResponse.json({ request: { ...request, payload }, steps: steps || [], actions: actions || [], currentUser: aiDoUser })
}
