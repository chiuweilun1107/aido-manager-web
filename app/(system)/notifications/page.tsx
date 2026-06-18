import { getSessionUser } from '@/lib/session'
import NotificationsView from '@/components/NotificationsView'

export default async function NotificationsPage() {
  const user = await getSessionUser()
  return <NotificationsView user={user} />
}
