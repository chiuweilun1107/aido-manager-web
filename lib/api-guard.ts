import { NextResponse } from 'next/server'
import { getSessionUser } from './session'
import type { SessionUser } from './types'
import { ADMIN_ROLES, isAdminRole, employeeViewScope } from './rbac'

// ADMIN_ROLES / isAdminRole / employeeViewScope 的單一真實來源已移至 lib/rbac.ts
// （client-safe，前端元件可直接引用而不會拉進 server-only 依賴）。此處 re-export
// 以維持既有 `@/lib/api-guard` import 路徑相容。
export { ADMIN_ROLES, isAdminRole, employeeViewScope }

// API route 授權守衛：登入 + 管理角色才放行。
// middleware 明文略過所有 /api 路由，故每個 admin API 必須自帶此 guard。
export async function requireAdminUser(): Promise<
  { user: SessionUser; error: null } | { user: null; error: ReturnType<typeof NextResponse.json> }
> {
  const user = await getSessionUser()
  if (!isAdminRole(user.roleCode)) {
    return { user: null, error: NextResponse.json({ error: '需管理權限' }, { status: 403 }) }
  }
  return { user, error: null }
}
