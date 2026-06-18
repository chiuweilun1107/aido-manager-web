import { getSessionUser } from '@/lib/session'
import { ROLE_DASHBOARDS, type DashShortcut } from '@/lib/rbac'
import DashboardView from '@/components/DashboardView'

export default async function DashboardPage() {
  const user = await getSessionUser()
  const shortcuts: DashShortcut[] = ROLE_DASHBOARDS[user.roleCode] || ROLE_DASHBOARDS.employee
  return <DashboardView user={user} shortcuts={shortcuts} />
}
