import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const db = svc.schema('aido')

  const { data: aiDoUser } = await db.from('users').select('*, roles!users_primary_role_id_fkey(code)').eq('auth_user_id', user.id).single()
  if (!aiDoUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const userId = aiDoUser.id
  const roleCode = aiDoUser.roles?.code ?? 'employee'
  const now = new Date().toISOString().slice(0, 10)

  const [
    { data: myRequests },
    { count: pendingCount },
    { data: announcements },
    { data: leaveBalances },
    { data: attendance }
  ] = await Promise.all([
    db.from('requests').select('id,request_no,module_code,title,status,created_at').eq('requester_user_id', userId).order('created_at', { ascending: false }).limit(5),
    db.from('approval_steps').select('id', { count: 'exact', head: true }).eq('status', 'active').or(`approver_user_id.eq.${userId}${aiDoUser.primary_role_id ? `,approver_role_id.eq.${aiDoUser.primary_role_id}` : ''}`),
    db.from('announcements').select('id,title,created_at').eq('status', 'published').order('created_at', { ascending: false }).limit(3),
    db.from('leave_balances').select('*, leave_types(name)').eq('user_id', userId),
    db.from('attendance_records').select('clock_in_at,clock_out_at').eq('user_id', userId).eq('work_date', now).maybeSingle()
  ])

  return NextResponse.json({
    roleCode, userId,
    my_requests: myRequests || [],
    pending_approvals_count: pendingCount || 0,
    announcements: announcements || [],
    leave_balances: leaveBalances || [],
    today_attendance: attendance
  })
}
