import { getSessionUser } from '@/lib/session'
import RequestDetailView from '@/components/RequestDetailView'

export default async function RequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getSessionUser()
  return <RequestDetailView requestId={Number(id)} user={user} />
}
