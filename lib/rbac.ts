export type RoleCode = 'employee' | 'manager' | 'hr' | 'it' | 'finance' | 'executive' | 'admin_officer' | 'legal' | 'auditor'

export const ROLE_READ_SCOPE: Record<string, 'self' | 'team' | 'all'> = {
  employee: 'self',
  manager: 'team',
  hr: 'all',
  it: 'all',
  finance: 'all',
  executive: 'all',
  admin_officer: 'all',
  legal: 'all',
  auditor: 'all'
}

export const FIELD_FULL_ACCESS: Record<string, string[]> = {
  salary: ['hr', 'finance', 'executive'],
  national_id: ['hr'],
  bank_account: ['finance', 'hr']
}

export function canSeeField(field: string, roleCode: string, isSelf: boolean): boolean {
  if (isSelf) return true
  const allowed = FIELD_FULL_ACCESS[field]
  if (!allowed) return true
  return allowed.includes(roleCode)
}

export function maskNationalId(val: string | null | undefined): string {
  if (!val) return ''
  return val.slice(0, 4) + '****' + val.slice(-2)
}

export function maskBank(val: string | null | undefined): string {
  if (!val) return ''
  return '****' + val.slice(-4)
}

export const ROLE_LABELS: Record<string, string> = {
  employee: '員工',
  manager: '主管',
  hr: 'HR',
  it: 'IT',
  finance: '財務',
  executive: '經營者',
  admin_officer: '行政',
  legal: '法務',
  auditor: '稽核'
}

export interface DashShortcut { title: string; link: string }

export const ROLE_DASHBOARDS: Record<string, DashShortcut[]> = {
  employee: [
    { title: '請假申請', link: '/module/leave' },
    { title: '出差/加班', link: '/module/overtime' },
    { title: '費用報帳', link: '/module/expense' },
    { title: '待簽核', link: '/approvals' },
  ],
  manager: [
    { title: '待簽核', link: '/approvals' },
    { title: '請假申請', link: '/module/leave' },
    { title: '人員管理', link: '/module/personnel' },
    { title: '費用報帳', link: '/module/expense' },
  ],
  hr: [
    { title: '待簽核', link: '/approvals' },
    { title: '人員異動', link: '/module/personnel' },
    { title: '薪資異動', link: '/module/compensation' },
    { title: '人力規劃', link: '/module/headcount' },
  ],
  it: [
    { title: '待簽核', link: '/approvals' },
    { title: 'IT 申請', link: '/module/it_support' },
    { title: '資產管理', link: '/module/asset' },
    { title: '存取控制', link: '/module/access_control' },
  ],
  finance: [
    { title: '待簽核', link: '/approvals' },
    { title: '費用報帳', link: '/module/expense' },
    { title: '採購申請', link: '/module/procurement' },
    { title: '薪資查詢', link: '/module/payroll' },
  ],
  executive: [
    { title: '待簽核', link: '/approvals' },
    { title: '薪資核定', link: '/module/payroll_publish' },
    { title: '人力規劃', link: '/module/headcount' },
    { title: 'BI 報表', link: '/module/executive_bi' },
  ],
  admin_officer: [
    { title: '待簽核', link: '/approvals' },
    { title: '用印申請', link: '/module/seal' },
    { title: '合約管理', link: '/module/contract' },
    { title: '公告發佈', link: '/module/announcement' },
  ],
  legal: [
    { title: '待簽核', link: '/approvals' },
    { title: '合約管理', link: '/module/contract' },
    { title: '合規檢查', link: '/module/compliance' },
    { title: '勞資關係', link: '/module/employee_relations' },
  ],
  auditor: [
    { title: '稽核日誌', link: '/module/audit_log' },
    { title: '合規檢查', link: '/module/compliance' },
    { title: '待簽核', link: '/approvals' },
    { title: 'BI 報表', link: '/module/executive_bi' },
  ],
}
