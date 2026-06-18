export type FieldType = 'text' | 'textarea' | 'number' | 'money' | 'date' | 'datetime' | 'select' | 'user'
export type ModuleKind = 'request' | 'record' | 'view'

export interface ModuleField {
  key: string
  label: string
  type?: FieldType
  required?: boolean
  options?: string[]
  placeholder?: string
  sensitive?: boolean
}

export interface ModuleColumn {
  key: string
  label: string
  type?: string
}

export interface Module {
  code: string
  name: string
  icon: string
  group: string
  kind: ModuleKind
  roles_visible: string[] | '*'
  view?: string
  table?: string
  chain?: string
  amountField?: string
  detailTable?: string | null
  fields?: ModuleField[]
  columns?: ModuleColumn[]
}

const ALL = '*' as const

export const MODULES: Module[] = [
  { code: 'approvals', name: '待簽核 / 我的申請', icon: 'clipboard-check', group: '我的工作區', kind: 'view', view: 'approvals', roles_visible: ALL },
  { code: 'ess', name: '個人設定', icon: 'cog', group: '我的工作區', kind: 'view', view: 'ess', roles_visible: ALL },
  { code: 'attendance', name: '出勤打卡', icon: 'clock', group: '我的工作區', kind: 'view', view: 'attendance', roles_visible: ALL },
  {
    code: 'leave', name: '請假', icon: 'calendar', group: '我的工作區', kind: 'request',
    chain: 'leave_default', detailTable: null, roles_visible: ALL,
    fields: [
      { key: 'leave_type', label: '假別', type: 'select', required: true, options: ['特休', '病假', '事假', '生理假', '公假', '補休'] },
      { key: 'start_at', label: '開始時間', type: 'datetime', required: true },
      { key: 'end_at', label: '結束時間', type: 'datetime', required: true },
      { key: 'hours', label: '時數', type: 'number', required: true },
      { key: 'reason', label: '事由', type: 'textarea' }
    ],
    columns: [
      { key: 'request_no', label: '單號' }, { key: 'payload.leave_type', label: '假別' },
      { key: 'payload.hours', label: '時數' }, { key: 'payload.start_at', label: '開始' }, { key: 'status', label: '狀態', type: 'status' }
    ]
  },
  {
    code: 'scheduling', name: '排班管理', icon: 'calendar-days', group: '差勤', kind: 'record', table: 'schedules',
    roles_visible: ['manager', 'hr', 'admin_officer', 'executive', 'auditor', 'employee'],
    fields: [
      { key: 'user_id', label: '員工', type: 'user', required: true },
      { key: 'work_date', label: '日期', type: 'date', required: true },
      { key: 'shift_code', label: '班別', type: 'select', options: ['A 早班', 'B 中班', 'C 晚班', '彈性'] },
      { key: 'start_time', label: '開始', type: 'text', placeholder: '09:00' },
      { key: 'end_time', label: '結束', type: 'text', placeholder: '18:00' },
      { key: 'day_type', label: '日別', type: 'select', options: ['workday', 'rest_day', 'regular_holiday', 'national_holiday'] }
    ],
    columns: [
      { key: 'work_date', label: '日期' }, { key: 'user_id', label: '員工', type: 'user' },
      { key: 'shift_code', label: '班別' }, { key: 'start_time', label: '開始' }, { key: 'end_time', label: '結束' }, { key: 'status', label: '狀態', type: 'status' }
    ]
  },
  {
    code: 'overtime', name: '加班申請', icon: 'clock-plus', group: '差勤', kind: 'request', chain: 'overtime_default', roles_visible: ALL,
    fields: [
      { key: 'work_date', label: '加班日期', type: 'date', required: true },
      { key: 'start_at', label: '開始', type: 'datetime', required: true },
      { key: 'end_at', label: '結束', type: 'datetime', required: true },
      { key: 'minutes', label: '分鐘', type: 'number', required: true },
      { key: 'day_type', label: '日別', type: 'select', options: ['workday', 'rest_day', 'regular_holiday'] },
      { key: 'reason', label: '事由', type: 'textarea' }
    ],
    columns: [
      { key: 'request_no', label: '單號' }, { key: 'payload.work_date', label: '日期' },
      { key: 'payload.minutes', label: '分鐘' }, { key: 'status', label: '狀態', type: 'status' }
    ]
  },
  {
    code: 'attendance_correction', name: '補打卡', icon: 'wrench', group: '差勤', kind: 'request', chain: 'attendance_correction_default', roles_visible: ALL,
    fields: [
      { key: 'work_date', label: '補卡日期', type: 'date', required: true },
      { key: 'correction_type', label: '類型', type: 'select', required: true, options: ['missing_in 缺上班卡', 'missing_out 缺下班卡', 'adjust_time 調整時間'] },
      { key: 'proposed_time', label: '補卡時間', type: 'datetime', required: true },
      { key: 'reason', label: '原因', type: 'textarea', required: true }
    ],
    columns: [
      { key: 'request_no', label: '單號' }, { key: 'payload.work_date', label: '日期' },
      { key: 'payload.correction_type', label: '類型' }, { key: 'status', label: '狀態', type: 'status' }
    ]
  },
  {
    code: 'expense', name: '費用報銷', icon: 'receipt', group: '行政 / 財務', kind: 'request', chain: 'expense_default', amountField: 'amount', roles_visible: ALL,
    fields: [
      { key: 'category', label: '類別', type: 'select', required: true, options: ['差旅', '餐費', '辦公用品', '訓練', '其他'] },
      { key: 'expense_date', label: '費用日期', type: 'date', required: true },
      { key: 'amount', label: '金額', type: 'money', required: true },
      { key: 'tax_id', label: '統編' },
      { key: 'reason', label: '說明', type: 'textarea' }
    ],
    columns: [
      { key: 'request_no', label: '單號' }, { key: 'payload.category', label: '類別' },
      { key: 'amount', label: '金額', type: 'money' }, { key: 'status', label: '狀態', type: 'status' }
    ]
  },
  {
    code: 'procurement', name: '採購', icon: 'shopping-cart', group: '行政 / 財務', kind: 'request', chain: 'procurement_default', amountField: 'amount', roles_visible: ALL,
    fields: [
      { key: 'item', label: '品項', type: 'text', required: true },
      { key: 'vendor', label: '供應商', type: 'text' },
      { key: 'category', label: '類別', type: 'select', options: ['IT', '辦公', '服務', '訓練'] },
      { key: 'amount', label: '金額', type: 'money', required: true },
      { key: 'budget_code', label: '預算科目' },
      { key: 'reason', label: '用途', type: 'textarea' }
    ],
    columns: [
      { key: 'request_no', label: '單號' }, { key: 'payload.item', label: '品項' },
      { key: 'amount', label: '金額', type: 'money' }, { key: 'status', label: '狀態', type: 'status' }
    ]
  },
  {
    code: 'seal', name: '用印', icon: 'document', group: '行政 / 財務', kind: 'request', chain: 'seal_default', amountField: 'amount', roles_visible: ALL,
    fields: [
      { key: 'seal_type', label: '印章', type: 'select', required: true, options: ['公司大章', '發票章', '合約章'] },
      { key: 'document_title', label: '文件名稱', type: 'text', required: true },
      { key: 'purpose', label: '用印目的', type: 'textarea', required: true },
      { key: 'counterparty', label: '相對方', type: 'text' },
      { key: 'legal_required', label: '需法務會辦', type: 'select', options: ['0 否', '1 是'] },
      { key: 'amount', label: '相關金額', type: 'money' }
    ],
    columns: [
      { key: 'request_no', label: '單號' }, { key: 'payload.document_title', label: '文件' },
      { key: 'payload.seal_type', label: '印章' }, { key: 'status', label: '狀態', type: 'status' }
    ]
  },
  {
    code: 'asset', name: '資產管理', icon: 'server', group: '行政 / 財務', kind: 'record', table: 'assets',
    roles_visible: ['admin_officer', 'it', 'hr', 'finance', 'executive', 'auditor', 'employee', 'manager'],
    fields: [
      { key: 'name', label: '資產名稱', type: 'text', required: true },
      { key: 'category', label: '類別', type: 'select', options: ['laptop', 'phone', 'furniture', 'software'] },
      { key: 'assigned_to_user_id', label: '保管人', type: 'user' },
      { key: 'status', label: '狀態', type: 'select', options: ['available', 'assigned', 'repairing', 'retired'] },
      { key: 'serial_no', label: '序號' }, { key: 'purchase_amount', label: '金額', type: 'money' }
    ],
    columns: [
      { key: 'asset_no', label: '編號' }, { key: 'name', label: '名稱' }, { key: 'category', label: '類別' },
      { key: 'assigned_to_user_id', label: '保管人', type: 'user' }, { key: 'status', label: '狀態', type: 'status' }
    ]
  },
  {
    code: 'contract', name: '合約管理', icon: 'document', group: '行政 / 財務', kind: 'record', table: 'contracts',
    roles_visible: ['legal', 'admin_officer', 'executive', 'finance', 'auditor', 'manager'],
    fields: [
      { key: 'title', label: '合約名稱', type: 'text', required: true },
      { key: 'party_name', label: '對方', type: 'text' },
      { key: 'contract_type', label: '類型', type: 'select', options: ['vendor', 'customer', 'employment', 'nda'] },
      { key: 'status', label: '狀態', type: 'select', options: ['draft', 'legal_review', 'active', 'expired', 'terminated'] },
      { key: 'start_date', label: '起日', type: 'date' }, { key: 'end_date', label: '到期日', type: 'date' },
      { key: 'amount', label: '金額', type: 'money' }
    ],
    columns: [
      { key: 'contract_no', label: '編號' }, { key: 'title', label: '名稱' }, { key: 'party_name', label: '對方' },
      { key: 'end_date', label: '到期' }, { key: 'status', label: '狀態', type: 'status' }
    ]
  },
  {
    code: 'benefit', name: '福利平台', icon: 'gift', group: '行政 / 財務', kind: 'request', chain: 'benefit_default', amountField: 'amount', roles_visible: ALL,
    fields: [
      { key: 'benefit_type', label: '福利', type: 'select', required: true, options: ['健檢補助', '員工旅遊', '生日禮金', '結婚補助', '生育補助'] },
      { key: 'amount', label: '金額', type: 'money', required: true },
      { key: 'reason', label: '說明', type: 'textarea' }
    ],
    columns: [
      { key: 'request_no', label: '單號' }, { key: 'payload.benefit_type', label: '福利' },
      { key: 'amount', label: '金額', type: 'money' }, { key: 'status', label: '狀態', type: 'status' }
    ]
  },
  { code: 'hrm', name: '員工管理', icon: 'users', group: '人資', kind: 'view', view: 'hrm', roles_visible: ['hr', 'executive', 'auditor', 'manager'] },
  { code: 'org', name: '組織架構', icon: 'building-office', group: '人資', kind: 'view', view: 'org', roles_visible: ALL },
  { code: 'payroll', name: '薪資管理', icon: 'currency-dollar', group: '人資', kind: 'view', view: 'payroll', roles_visible: ['hr', 'finance', 'executive', 'auditor', 'employee', 'manager'] },
  {
    code: 'compensation', name: '調薪', icon: 'trending-up', group: '人資', kind: 'request', chain: 'compensation_default',
    roles_visible: ['hr', 'manager', 'finance', 'executive', 'auditor'],
    fields: [
      { key: 'target_user_id', label: '調薪對象', type: 'user', required: true },
      { key: 'effective_date', label: '生效日', type: 'date', required: true },
      { key: 'new_salary', label: '新薪資', type: 'money', required: true, sensitive: true },
      { key: 'change_percent', label: '調幅 %', type: 'number' },
      { key: 'reason', label: '理由', type: 'textarea', required: true }
    ],
    columns: [
      { key: 'request_no', label: '單號' }, { key: 'payload.target_user_id', label: '對象', type: 'user' },
      { key: 'payload.effective_date', label: '生效日' }, { key: 'status', label: '狀態', type: 'status' }
    ]
  },
  {
    code: 'personnel', name: '人事異動', icon: 'arrows-right-left', group: '人資', kind: 'request', chain: 'personnel_default',
    roles_visible: ['hr', 'manager', 'executive', 'auditor'],
    fields: [
      { key: 'target_user_id', label: '異動員工', type: 'user', required: true },
      { key: 'change_type', label: '類型', type: 'select', required: true, options: ['transfer 轉調', 'promotion 升職', 'demotion 降職', 'manager_change 主管變更', 'leave_without_pay 留職停薪'] },
      { key: 'effective_date', label: '生效日', type: 'date', required: true },
      { key: 'new_department', label: '新部門' }, { key: 'new_position', label: '新職位' },
      { key: 'reason', label: '原因', type: 'textarea' }
    ],
    columns: [
      { key: 'request_no', label: '單號' }, { key: 'payload.target_user_id', label: '員工', type: 'user' },
      { key: 'payload.change_type', label: '類型' }, { key: 'status', label: '狀態', type: 'status' }
    ]
  },
  {
    code: 'probation', name: '試用期評核', icon: 'academic-cap', group: '人資', kind: 'request', chain: 'probation_default',
    roles_visible: ['hr', 'manager', 'executive', 'auditor'],
    fields: [
      { key: 'target_user_id', label: '評核對象', type: 'user', required: true },
      { key: 'milestone', label: '評核節點', type: 'select', required: true, options: ['30 天', '60 天', '90 天'] },
      { key: 'result', label: '建議', type: 'select', required: true, options: ['通過轉正', '延長試用', '不適任'] },
      { key: 'comment', label: '評語', type: 'textarea' }
    ],
    columns: [
      { key: 'request_no', label: '單號' }, { key: 'payload.target_user_id', label: '對象', type: 'user' },
      { key: 'payload.milestone', label: '節點' }, { key: 'payload.result', label: '建議' }, { key: 'status', label: '狀態', type: 'status' }
    ]
  },
  {
    code: 'performance', name: '績效管理', icon: 'star', group: '人資', kind: 'record', table: 'performance_reviews',
    roles_visible: ['hr', 'manager', 'executive', 'auditor', 'employee'],
    fields: [
      { key: 'user_id', label: '受評人', type: 'user', required: true },
      { key: 'period', label: '週期', type: 'text', placeholder: '2026 H1' },
      { key: 'type', label: '類型', type: 'select', options: ['KPI', 'OKR', '360', 'MBO'] },
      { key: 'score', label: '分數', type: 'number' },
      { key: 'status', label: '狀態', type: 'select', options: ['draft', 'in_review', 'finalized'] },
      { key: 'summary', label: '摘要', type: 'textarea' }
    ],
    columns: [
      { key: 'user_id', label: '受評人', type: 'user' }, { key: 'period', label: '週期' },
      { key: 'type', label: '類型' }, { key: 'score', label: '分數' }, { key: 'status', label: '狀態', type: 'status' }
    ]
  },
  {
    code: 'lms', name: '教育訓練', icon: 'book-open', group: '人資', kind: 'record', table: 'training_records', roles_visible: ALL,
    fields: [
      { key: 'user_id', label: '學員', type: 'user', required: true },
      { key: 'course_name', label: '課程', type: 'text', required: true },
      { key: 'category', label: '類別', type: 'select', options: ['法遵', '資安', '專業', '管理'] },
      { key: 'status', label: '狀態', type: 'select', options: ['enrolled', 'in_progress', 'completed'] },
      { key: 'hours', label: '時數', type: 'number' }
    ],
    columns: [
      { key: 'user_id', label: '學員', type: 'user' }, { key: 'course_name', label: '課程' },
      { key: 'category', label: '類別' }, { key: 'status', label: '狀態', type: 'status' }
    ]
  },
  {
    code: 'ats', name: '招募 ATS', icon: 'user-plus', group: '人資', kind: 'record', table: 'candidates',
    roles_visible: ['hr', 'manager', 'executive', 'auditor'],
    fields: [
      { key: 'name', label: '應徵者', type: 'text', required: true },
      { key: 'position_applied', label: '應徵職位', type: 'text' },
      { key: 'stage', label: '階段', type: 'select', options: ['applied', 'screening', 'interview', 'offer', 'hired', 'rejected'] },
      { key: 'source', label: '來源', type: 'select', options: ['104', '1111', 'LinkedIn', '內推'] },
      { key: 'rating', label: '評分', type: 'number' }
    ],
    columns: [
      { key: 'name', label: '應徵者' }, { key: 'position_applied', label: '職位' },
      { key: 'stage', label: '階段', type: 'status' }, { key: 'source', label: '來源' }
    ]
  },
  {
    code: 'onboarding', name: '新人報到', icon: 'academic-cap', group: '人資', kind: 'record', table: 'onboarding_cases',
    roles_visible: ['hr', 'it', 'admin_officer', 'finance', 'executive', 'auditor', 'manager'],
    fields: [
      { key: 'user_id', label: '新人', type: 'user', required: true },
      { key: 'start_date', label: '到職日', type: 'date' },
      { key: 'target_date', label: '完成目標', type: 'date' },
      { key: 'status', label: '狀態', type: 'select', options: ['draft', 'active', 'completed', 'cancelled'] }
    ],
    columns: [
      { key: 'user_id', label: '新人', type: 'user' }, { key: 'start_date', label: '到職日' }, { key: 'status', label: '狀態', type: 'status' }
    ]
  },
  {
    code: 'offboarding', name: '離職', icon: 'arrow-right-start', group: '人資', kind: 'record', table: 'offboarding_cases',
    roles_visible: ['hr', 'it', 'admin_officer', 'finance', 'legal', 'executive', 'auditor', 'manager'],
    fields: [
      { key: 'user_id', label: '離職員工', type: 'user', required: true },
      { key: 'target_date', label: '離職日', type: 'date' },
      { key: 'status', label: '狀態', type: 'select', options: ['draft', 'active', 'completed', 'cancelled'] }
    ],
    columns: [
      { key: 'user_id', label: '員工', type: 'user' }, { key: 'target_date', label: '離職日' }, { key: 'status', label: '狀態', type: 'status' }
    ]
  },
  {
    code: 'er', name: '員工關係', icon: 'handshake', group: '人資', kind: 'record', table: 'er_cases',
    roles_visible: ['hr', 'legal', 'executive', 'auditor'],
    fields: [
      { key: 'case_type', label: '類型', type: 'select', required: true, options: ['complaint 申訴', 'dispute 爭議', 'counseling 輔導', 'discipline 獎懲'] },
      { key: 'target_user_id', label: '關係人', type: 'user' },
      { key: 'severity', label: '嚴重度', type: 'select', options: ['low', 'medium', 'high'] },
      { key: 'status', label: '狀態', type: 'select', options: ['open', 'investigating', 'resolved', 'closed'] },
      { key: 'summary', label: '摘要', type: 'textarea' }
    ],
    columns: [
      { key: 'case_no', label: '案件' }, { key: 'case_type', label: '類型' },
      { key: 'severity', label: '嚴重度' }, { key: 'status', label: '狀態', type: 'status' }
    ]
  },
  { code: 'workforce', name: '人力編制', icon: 'chart-bar', group: '人資', kind: 'view', view: 'workforce', roles_visible: ['hr', 'manager', 'finance', 'executive', 'auditor'] },
  {
    code: 'announcement', name: '公告', icon: 'megaphone', group: '治理 / 系統', kind: 'record', table: 'announcements', roles_visible: ALL,
    fields: [
      { key: 'title', label: '標題', type: 'text', required: true },
      { key: 'body', label: '內容', type: 'textarea', required: true },
      { key: 'require_ack', label: '需確認閱讀', type: 'select', options: ['0 否', '1 是'] }
    ],
    columns: [
      { key: 'title', label: '標題' }, { key: 'created_at', label: '發布', type: 'datetime' }, { key: 'status', label: '狀態', type: 'status' }
    ]
  },
  {
    code: 'knowledge', name: '知識庫', icon: 'book', group: '治理 / 系統', kind: 'record', table: 'knowledge_docs', roles_visible: ALL,
    fields: [
      { key: 'title', label: '標題', type: 'text', required: true },
      { key: 'category', label: '分類', type: 'select', options: ['HR', 'IT', 'Finance', 'Legal', 'Admin'] },
      { key: 'content', label: '內容', type: 'textarea', required: true },
      { key: 'status', label: '狀態', type: 'select', options: ['draft', 'published', 'archived'] }
    ],
    columns: [
      { key: 'title', label: '標題' }, { key: 'category', label: '分類' }, { key: 'status', label: '狀態', type: 'status' }
    ]
  },
  {
    code: 'it_service', name: 'IT 服務台', icon: 'computer-desktop', group: '治理 / 系統', kind: 'record', table: 'it_tickets', roles_visible: ALL,
    fields: [
      { key: 'subject', label: '主旨', type: 'text', required: true },
      { key: 'category', label: '類別', type: 'select', options: ['account', 'device', 'software', 'network'] },
      { key: 'priority', label: '優先', type: 'select', options: ['low', 'medium', 'high', 'urgent'] },
      { key: 'assignee_user_id', label: '承辦', type: 'user' },
      { key: 'status', label: '狀態', type: 'select', options: ['open', 'assigned', 'pending_user', 'resolved', 'closed'] },
      { key: 'description', label: '描述', type: 'textarea' }
    ],
    columns: [
      { key: 'ticket_no', label: '工單' }, { key: 'subject', label: '主旨' },
      { key: 'priority', label: '優先' }, { key: 'status', label: '狀態', type: 'status' }
    ]
  },
  {
    code: 'compliance', name: '合規監控', icon: 'shield-check', group: '治理 / 系統', kind: 'record', table: 'compliance_checks',
    roles_visible: ['hr', 'legal', 'auditor', 'executive', 'it'],
    fields: [
      { key: 'check_type', label: '類型', type: 'select', required: true, options: ['工時超標', '未申報加班', '特休遞延', '個資存取', '權限異常'] },
      { key: 'subject', label: '主旨', type: 'text', required: true },
      { key: 'severity', label: '嚴重度', type: 'select', options: ['low', 'medium', 'high'] },
      { key: 'status', label: '狀態', type: 'select', options: ['open', 'reviewing', 'closed'] },
      { key: 'detail', label: '細節', type: 'textarea' }
    ],
    columns: [
      { key: 'check_type', label: '類型' }, { key: 'subject', label: '主旨' },
      { key: 'severity', label: '嚴重度' }, { key: 'status', label: '狀態', type: 'status' }
    ]
  },
  { code: 'bi', name: '報表 BI', icon: 'chart-bar-square', group: '治理 / 系統', kind: 'view', view: 'bi', roles_visible: ['hr', 'finance', 'executive', 'auditor', 'manager', 'it', 'admin_officer'] },
  { code: 'rbac', name: '權限管理', icon: 'lock-closed', group: '治理 / 系統', kind: 'view', view: 'rbac', roles_visible: ['hr', 'it', 'executive', 'auditor'] },
  { code: 'audit', name: '稽核日誌', icon: 'magnifying-glass', group: '治理 / 系統', kind: 'view', view: 'audit', roles_visible: ['auditor', 'hr', 'executive', 'it'] }
]

export const MODULE_MAP = Object.fromEntries(MODULES.map(m => [m.code, m]))

export function visibleModules(roleCode: string): Module[] {
  return MODULES.filter(m => m.roles_visible === ALL || (Array.isArray(m.roles_visible) && m.roles_visible.includes(roleCode)))
}
