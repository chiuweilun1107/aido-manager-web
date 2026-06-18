import { createClient } from './supabase/server'
import { createServiceClient } from './supabase/server'
import { SessionUser } from './types'
import { redirect } from 'next/navigation'

export async function getSessionUser(): Promise<SessionUser> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const service = createServiceClient()
  const { data: aiDoUser } = await service.schema('aido').from('users')
    .select('*, roles!users_primary_role_id_fkey(*), departments!users_department_id_fkey(*)')
    .eq('auth_user_id', user.id)
    .single()

  if (!aiDoUser) redirect('/login')

  return {
    authId: user.id,
    id: aiDoUser.id,
    email: aiDoUser.email,
    displayName: aiDoUser.display_name,
    roleCode: aiDoUser.roles?.code ?? 'employee',
    roleName: aiDoUser.roles?.name ?? '員工',
    departmentId: aiDoUser.department_id,
    departmentName: aiDoUser.departments?.name ?? null,
    managerId: aiDoUser.manager_user_id,
    employeeNo: aiDoUser.employee_no
  }
}
