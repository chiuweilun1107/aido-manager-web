export interface ChainStep {
  step_no: number
  name: string
  type: 'serial' | 'parallel'
  approver?: { resolver: string; role_code?: string; fallback?: { resolver: string } }
  approvers?: Array<{ resolver: string; role_code?: string }>
  required: 'all' | 'any'
  sla_hours?: number
  condition?: { field: string; op: string; value: number }
  skip_when?: Record<string, unknown>
}

export interface Chain {
  chain_code: string
  amount_field?: string
  steps: ChainStep[]
  post_approve_hooks?: string[]
}

export const CHAINS: Record<string, Chain> = {
  leave_default: {
    chain_code: 'leave_default',
    steps: [
      { step_no: 10, name: '直屬主管', type: 'serial', approver: { resolver: 'direct_manager', fallback: { resolver: 'department_manager' } }, required: 'all', sla_hours: 48 },
      { step_no: 20, name: 'HR 備查', type: 'serial', approver: { resolver: 'role', role_code: 'hr' }, required: 'any', sla_hours: 72 }
    ],
    post_approve_hooks: ['deduct_leave_balance']
  },
  overtime_default: {
    chain_code: 'overtime_default',
    steps: [
      { step_no: 10, name: '直屬主管', type: 'serial', approver: { resolver: 'direct_manager', fallback: { resolver: 'department_manager' } }, required: 'all' },
      { step_no: 20, name: 'HR 工時合規', type: 'serial', approver: { resolver: 'role', role_code: 'hr' }, required: 'any' },
      { step_no: 30, name: '財務薪資計算', type: 'serial', approver: { resolver: 'role', role_code: 'finance' }, required: 'any' }
    ]
  },
  attendance_correction_default: {
    chain_code: 'attendance_correction_default',
    steps: [
      { step_no: 10, name: '直屬主管', type: 'serial', approver: { resolver: 'direct_manager', fallback: { resolver: 'department_manager' } }, required: 'all' },
      { step_no: 20, name: 'HR 備查', type: 'serial', approver: { resolver: 'role', role_code: 'hr' }, required: 'any' }
    ],
    post_approve_hooks: ['apply_attendance_correction']
  },
  expense_default: {
    chain_code: 'expense_default',
    amount_field: 'amount',
    steps: [
      { step_no: 10, name: '直屬主管', type: 'serial', approver: { resolver: 'direct_manager', fallback: { resolver: 'department_manager' } }, required: 'all' },
      { step_no: 20, name: '部門主管', type: 'serial', condition: { field: 'amount', op: '>', value: 5000 }, approver: { resolver: 'department_manager' }, required: 'all' },
      { step_no: 30, name: '財務審核', type: 'serial', approver: { resolver: 'role', role_code: 'finance' }, required: 'any' },
      { step_no: 40, name: '經營者高額核決', type: 'serial', condition: { field: 'amount', op: '>', value: 50000 }, approver: { resolver: 'role', role_code: 'executive' }, required: 'any' }
    ],
    post_approve_hooks: ['mark_expense_scheduled']
  },
  procurement_default: {
    chain_code: 'procurement_default',
    amount_field: 'amount',
    steps: [
      { step_no: 10, name: '直屬主管', type: 'serial', approver: { resolver: 'direct_manager', fallback: { resolver: 'department_manager' } }, required: 'all' },
      { step_no: 20, name: '部門主管', type: 'serial', condition: { field: 'amount', op: '>', value: 10000 }, approver: { resolver: 'department_manager' }, required: 'all' },
      { step_no: 30, name: '財務審核', type: 'serial', approver: { resolver: 'role', role_code: 'finance' }, required: 'any' },
      { step_no: 40, name: '經營者高額核決', type: 'serial', condition: { field: 'amount', op: '>', value: 100000 }, approver: { resolver: 'role', role_code: 'executive' }, required: 'any' }
    ],
    post_approve_hooks: ['mark_po_approved']
  },
  seal_default: {
    chain_code: 'seal_default',
    amount_field: 'amount',
    steps: [
      { step_no: 10, name: '直屬主管', type: 'serial', approver: { resolver: 'direct_manager', fallback: { resolver: 'department_manager' } }, required: 'all' },
      { step_no: 20, name: '行政＋法務 並會', type: 'parallel', required: 'all', approvers: [{ resolver: 'role', role_code: 'admin_officer' }, { resolver: 'role', role_code: 'legal' }] },
      { step_no: 30, name: '經營者核決', type: 'serial', condition: { field: 'amount', op: '>', value: 100000 }, approver: { resolver: 'role', role_code: 'executive' }, required: 'any' }
    ],
    post_approve_hooks: ['mark_seal_ready']
  },
  benefit_default: {
    chain_code: 'benefit_default',
    steps: [
      { step_no: 10, name: '直屬主管', type: 'serial', approver: { resolver: 'direct_manager', fallback: { resolver: 'department_manager' } }, required: 'all' },
      { step_no: 20, name: 'HR 確認', type: 'serial', approver: { resolver: 'role', role_code: 'hr' }, required: 'any' }
    ]
  },
  compensation_default: {
    chain_code: 'compensation_default',
    steps: [
      { step_no: 10, name: '部門主管', type: 'serial', approver: { resolver: 'department_manager' }, required: 'all' },
      { step_no: 20, name: 'HR 審核', type: 'serial', approver: { resolver: 'role', role_code: 'hr' }, required: 'any' },
      { step_no: 30, name: '財務確認', type: 'serial', approver: { resolver: 'role', role_code: 'finance' }, required: 'any' },
      { step_no: 40, name: '經營者核准', type: 'serial', approver: { resolver: 'role', role_code: 'executive' }, required: 'any' }
    ],
    post_approve_hooks: ['apply_compensation_change']
  },
  personnel_default: {
    chain_code: 'personnel_default',
    steps: [
      { step_no: 10, name: '原主管', type: 'serial', approver: { resolver: 'direct_manager', fallback: { resolver: 'department_manager' } }, required: 'all' },
      { step_no: 20, name: 'HR 審核', type: 'serial', approver: { resolver: 'role', role_code: 'hr' }, required: 'any' }
    ],
    post_approve_hooks: ['apply_personnel_change']
  },
  probation_default: {
    chain_code: 'probation_default',
    steps: [
      { step_no: 10, name: '主管評核', type: 'serial', approver: { resolver: 'direct_manager', fallback: { resolver: 'department_manager' } }, required: 'all' },
      { step_no: 20, name: 'HR 審核', type: 'serial', approver: { resolver: 'role', role_code: 'hr' }, required: 'any' }
    ]
  },
  headcount_default: {
    chain_code: 'headcount_default',
    steps: [
      { step_no: 10, name: 'HR 審核', type: 'serial', approver: { resolver: 'role', role_code: 'hr' }, required: 'any' },
      { step_no: 20, name: '財務預算', type: 'serial', approver: { resolver: 'role', role_code: 'finance' }, required: 'any' },
      { step_no: 30, name: '經營者核准', type: 'serial', approver: { resolver: 'role', role_code: 'executive' }, required: 'any' }
    ]
  }
}
