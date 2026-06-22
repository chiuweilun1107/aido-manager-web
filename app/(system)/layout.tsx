import { getSessionUser } from '@/lib/session'
import { resolveRolePermissions, getEffectiveModules, getMenuGroups } from '@/lib/platform-config'
import Sidebar from '@/components/Sidebar'
import TopBar from '@/components/TopBar'

export default async function SystemLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser()
  const [perms, effModules, groupOrder] = await Promise.all([
    resolveRolePermissions(user.companyId, user.roleCode),
    getEffectiveModules(user.companyId),      // code 預設 + DB 自訂表單
    getMenuGroups(user.companyId),            // DB 可自訂群組順序
  ])
  // 依權限過濾可見 module (含自訂表單)
  const visibleMods = effModules.filter(m => perms.visibleModuleCodes.includes(m.code))
  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg)' }}>
      <Sidebar roleCode={user.roleCode} modules={visibleMods} groupOrder={groupOrder} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <TopBar user={user} />
        <main style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
