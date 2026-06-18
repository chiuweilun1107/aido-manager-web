import { getSessionUser } from '@/lib/session'
import { MODULE_MAP, visibleModules } from '@/lib/modules'
import { notFound } from 'next/navigation'
import ModuleView from '@/components/ModuleView'

export default async function ModulePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const user = await getSessionUser()
  const mod = MODULE_MAP[code]
  if (!mod) notFound()
  const visible = visibleModules(user.roleCode)
  if (!visible.find(m => m.code === code)) notFound()
  return <ModuleView module={mod} user={user} />
}
