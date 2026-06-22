import { getSessionUser } from '@/lib/session'
import { resolveFormFields, resolveRolePermissions, getEffectiveModules } from '@/lib/platform-config'
import { SessionUser } from '@/lib/types'
import { notFound } from 'next/navigation'
import type { ComponentType } from 'react'
import ModuleView from '@/components/ModuleView'
import BIView from '@/components/BIView'
import OrgView from '@/components/admin/OrgView'
import HrmView from '@/components/admin/HrmView'
import RBACView from '@/components/admin/RBACView'
import FormBuilderView from '@/components/admin/FormBuilderView'
import WorkflowDesignerView from '@/components/admin/WorkflowDesignerView'
import MenuGroupsView from '@/components/admin/MenuGroupsView'

// view code → admin component。新增 admin 頁只需在此註冊 + modules.ts 加 view module
const VIEW_MAP: Record<string, ComponentType<{ user: SessionUser }>> = {
  org: OrgView,
  hrm: HrmView,
  rbac: RBACView,
  forms: FormBuilderView,
  workflows: WorkflowDesignerView,
  'menu-groups': MenuGroupsView,
}

export default async function ModulePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const user = await getSessionUser()
  // 完整 module 清單(含自訂表單) → 找目標 module
  const effModules = await getEffectiveModules(user.companyId)
  const mod = effModules.find(m => m.code === code)
  if (!mod) notFound()
  // 可見性守衛改用 DB 權限 (權限管理編輯結果) → fallback code
  const perms = await resolveRolePermissions(user.companyId, user.roleCode)
  if (!perms.visibleModuleCodes.includes(code)) notFound()
  // view 類特殊頁 dispatch
  if (mod.kind === 'view' && mod.view === 'bi') return <BIView />
  if (mod.kind === 'view' && mod.view && VIEW_MAP[mod.view]) {
    const C = VIEW_MAP[mod.view]
    return <C user={user} />
  }
  // 表單欄位/簽核綁定 DB 優先 (表單設計器編輯結果) → fallback code module.fields
  let effMod = mod
  if (mod.kind === 'request') {
    const rf = await resolveFormFields(user.companyId, code)
    if (rf) effMod = { ...mod, fields: rf.fields, columns: rf.columns ?? mod.columns, chain: rf.chainCode ?? mod.chain }
  }
  return <ModuleView module={effMod} user={user} />
}
