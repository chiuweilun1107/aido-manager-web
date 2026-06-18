import { getSessionUser } from '@/lib/session'
import ApprovalsView from '@/components/ApprovalsView'

export default async function ApprovalsPage() {
  const user = await getSessionUser()
  return <ApprovalsView user={user} />
}
