import { getSessionUser } from '@/lib/session'
import Sidebar from '@/components/Sidebar'
import TopBar from '@/components/TopBar'

export default async function SystemLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser()
  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg)' }}>
      <Sidebar roleCode={user.roleCode} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <TopBar user={user} />
        <main style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
