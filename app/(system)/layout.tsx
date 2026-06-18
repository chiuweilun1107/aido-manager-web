import { getSessionUser } from '@/lib/session'
import Sidebar from '@/components/Sidebar'
import TopBar from '@/components/TopBar'

export default async function SystemLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser()
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar roleCode={user.roleCode} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar user={user} />
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
