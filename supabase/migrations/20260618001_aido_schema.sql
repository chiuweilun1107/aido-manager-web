-- AiDo 智行 企業行政管理平台 — PostgreSQL Schema (aido schema)
-- 獨立 aido schema，與 public (huayang-expense-poc) 完全隔離

CREATE SCHEMA IF NOT EXISTS aido;

-- PostgREST expose aido schema
ALTER ROLE authenticator SET pgrst.db_schemas = 'public, aido';
NOTIFY pgrst, 'reload config';

-- Permissions
GRANT USAGE ON SCHEMA aido TO postgres, anon, authenticated, service_role;

-- ============ 1.1 帳號、角色、組織 ============

CREATE TABLE aido.roles (
  id BIGSERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  dashboard_route TEXT NOT NULL,
  level INTEGER DEFAULT 0,
  is_system BOOLEAN DEFAULT TRUE
);

CREATE TABLE aido.departments (
  id BIGSERIAL PRIMARY KEY,
  code TEXT UNIQUE,
  name TEXT NOT NULL,
  parent_id BIGINT REFERENCES aido.departments(id),
  manager_user_id BIGINT,
  path TEXT,
  sort_order INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  cost_center TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_aido_departments_parent ON aido.departments(parent_id);

CREATE TABLE aido.positions (
  id BIGSERIAL PRIMARY KEY,
  code TEXT UNIQUE,
  title TEXT NOT NULL,
  grade TEXT,
  job_family TEXT,
  is_manager BOOLEAN DEFAULT FALSE,
  default_salary_grade TEXT,
  status TEXT DEFAULT 'active'
);

CREATE TABLE aido.users (
  id BIGSERIAL PRIMARY KEY,
  auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  employee_no TEXT UNIQUE,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  primary_role_id BIGINT REFERENCES aido.roles(id),
  department_id BIGINT REFERENCES aido.departments(id),
  position_id BIGINT REFERENCES aido.positions(id),
  manager_user_id BIGINT,
  hired_at TIMESTAMPTZ,
  resigned_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  two_factor_enabled BOOLEAN DEFAULT FALSE,
  two_factor_secret TEXT,
  locale TEXT DEFAULT 'zh-TW',
  timezone TEXT DEFAULT 'Asia/Taipei',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_aido_users_dept ON aido.users(department_id);
CREATE INDEX idx_aido_users_manager ON aido.users(manager_user_id);
CREATE INDEX idx_aido_users_status ON aido.users(status);

-- Self-FK and circular FK added after tables
ALTER TABLE aido.users ADD CONSTRAINT fk_users_manager FOREIGN KEY (manager_user_id) REFERENCES aido.users(id);
ALTER TABLE aido.departments ADD CONSTRAINT fk_dept_manager FOREIGN KEY (manager_user_id) REFERENCES aido.users(id);

CREATE TABLE aido.user_roles (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES aido.users(id),
  role_id BIGINT NOT NULL REFERENCES aido.roles(id),
  scope_type TEXT DEFAULT 'self',
  scope_department_id BIGINT REFERENCES aido.departments(id),
  valid_from TIMESTAMPTZ,
  valid_to TIMESTAMPTZ
);

-- ============ 1.2 表單與 BPM 核心 ============

CREATE TABLE aido.form_definitions (
  id BIGSERIAL PRIMARY KEY,
  module_code TEXT NOT NULL,
  form_code TEXT NOT NULL,
  name TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  schema_json TEXT,
  validation_json TEXT,
  approval_chain_json TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  effective_from TIMESTAMPTZ,
  effective_to TIMESTAMPTZ
);

CREATE TABLE aido.requests (
  id BIGSERIAL PRIMARY KEY,
  request_no TEXT UNIQUE NOT NULL,
  form_definition_id BIGINT REFERENCES aido.form_definitions(id),
  module_code TEXT NOT NULL,
  form_code TEXT NOT NULL,
  requester_user_id BIGINT NOT NULL REFERENCES aido.users(id),
  requester_department_id BIGINT REFERENCES aido.departments(id),
  title TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  current_step_no INTEGER,
  amount NUMERIC(14,2),
  currency TEXT DEFAULT 'TWD',
  payload_json TEXT,
  risk_level TEXT DEFAULT 'low',
  submitted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  source TEXT DEFAULT 'manual',
  ai_draft_id BIGINT,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_aido_requests_requester ON aido.requests(requester_user_id);
CREATE INDEX idx_aido_requests_module_status ON aido.requests(module_code, status);
CREATE INDEX idx_aido_requests_dept ON aido.requests(requester_department_id);

CREATE TABLE aido.approval_steps (
  id BIGSERIAL PRIMARY KEY,
  request_id BIGINT NOT NULL REFERENCES aido.requests(id),
  step_no INTEGER NOT NULL,
  step_type TEXT DEFAULT 'serial',
  name TEXT,
  approver_type TEXT,
  approver_user_id BIGINT REFERENCES aido.users(id),
  approver_role_id BIGINT REFERENCES aido.roles(id),
  required_mode TEXT DEFAULT 'all',
  status TEXT DEFAULT 'pending',
  due_at TIMESTAMPTZ,
  delegated_from_user_id BIGINT REFERENCES aido.users(id),
  delegated_to_user_id BIGINT REFERENCES aido.users(id),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  config_json TEXT
);
CREATE INDEX idx_aido_steps_request ON aido.approval_steps(request_id);
CREATE INDEX idx_aido_steps_active ON aido.approval_steps(status, approver_user_id);
CREATE INDEX idx_aido_steps_role ON aido.approval_steps(status, approver_role_id);

CREATE TABLE aido.approval_actions (
  id BIGSERIAL PRIMARY KEY,
  request_id BIGINT NOT NULL REFERENCES aido.requests(id),
  approval_step_id BIGINT REFERENCES aido.approval_steps(id),
  actor_user_id BIGINT NOT NULL REFERENCES aido.users(id),
  action TEXT NOT NULL,
  comment TEXT,
  from_status TEXT,
  to_status TEXT,
  action_payload_json TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_aido_actions_request ON aido.approval_actions(request_id);
CREATE INDEX idx_aido_actions_actor ON aido.approval_actions(actor_user_id);

-- ============ 1.3 稽核、通知 ============

CREATE TABLE aido.audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_user_id BIGINT REFERENCES aido.users(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id BIGINT,
  module_code TEXT,
  before_json TEXT,
  after_json TEXT,
  fields_accessed_json TEXT,
  field_masking_applied BOOLEAN DEFAULT FALSE,
  ip_address TEXT,
  user_agent TEXT,
  request_id TEXT,
  legal_basis TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_aido_audit_actor ON aido.audit_logs(actor_user_id, created_at);
CREATE INDEX idx_aido_audit_entity ON aido.audit_logs(entity_type, entity_id);
CREATE INDEX idx_aido_audit_module ON aido.audit_logs(module_code, created_at);

CREATE TABLE aido.notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES aido.users(id),
  channel TEXT DEFAULT 'in_app',
  title TEXT,
  body TEXT,
  link_url TEXT,
  related_entity_type TEXT,
  related_entity_id BIGINT,
  status TEXT DEFAULT 'queued',
  read_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_aido_notif_user ON aido.notifications(user_id, status);

CREATE TABLE aido.notification_preferences (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES aido.users(id),
  event_code TEXT NOT NULL,
  in_app BOOLEAN DEFAULT TRUE,
  email BOOLEAN DEFAULT FALSE,
  line BOOLEAN DEFAULT FALSE,
  sms BOOLEAN DEFAULT FALSE
);

-- ============ 1.4 ESS ============

CREATE TABLE aido.user_profiles (
  user_id BIGINT PRIMARY KEY REFERENCES aido.users(id),
  legal_name TEXT,
  english_name TEXT,
  national_id_encrypted TEXT,
  national_id_last4 TEXT,
  birth_date DATE,
  mobile TEXT,
  address TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  bank_code TEXT,
  bank_account_encrypted TEXT,
  bank_account_last4 TEXT,
  avatar_file_id BIGINT
);

CREATE TABLE aido.user_delegates (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES aido.users(id),
  delegate_user_id BIGINT NOT NULL REFERENCES aido.users(id),
  module_code TEXT DEFAULT 'all',
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  reason TEXT,
  status TEXT DEFAULT 'active'
);

CREATE TABLE aido.user_files (
  id BIGSERIAL PRIMARY KEY,
  owner_user_id BIGINT NOT NULL REFERENCES aido.users(id),
  file_name TEXT,
  file_path TEXT,
  mime_type TEXT,
  size_bytes INTEGER,
  category TEXT,
  visibility TEXT DEFAULT 'private',
  checksum TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============ 1.5 假勤、排班、出勤 ============

CREATE TABLE aido.leave_types (
  id BIGSERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  unit TEXT DEFAULT 'hour',
  paid_type TEXT DEFAULT 'paid',
  require_attachment BOOLEAN DEFAULT FALSE,
  min_unit_hours NUMERIC(4,1) DEFAULT 1,
  annual_quota_rule_json TEXT,
  carryover_allowed BOOLEAN DEFAULT FALSE,
  carryover_requires_consent BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE aido.leave_balances (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES aido.users(id),
  leave_type_id BIGINT NOT NULL REFERENCES aido.leave_types(id),
  period_year INTEGER NOT NULL,
  granted_hours NUMERIC(8,2) DEFAULT 0,
  used_hours NUMERIC(8,2) DEFAULT 0,
  pending_hours NUMERIC(8,2) DEFAULT 0,
  carried_over_hours NUMERIC(8,2) DEFAULT 0,
  expired_hours NUMERIC(8,2) DEFAULT 0,
  paid_out_hours NUMERIC(8,2) DEFAULT 0,
  version INTEGER DEFAULT 1,
  UNIQUE(user_id, leave_type_id, period_year)
);

CREATE TABLE aido.schedules (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES aido.users(id),
  work_date DATE NOT NULL,
  shift_code TEXT,
  start_time TIME,
  end_time TIME,
  break_minutes INTEGER DEFAULT 60,
  day_type TEXT DEFAULT 'workday',
  department_id BIGINT REFERENCES aido.departments(id),
  created_by_user_id BIGINT REFERENCES aido.users(id),
  published_at TIMESTAMPTZ,
  status TEXT DEFAULT 'draft',
  UNIQUE(user_id, work_date)
);

-- 法定不可刪（無 deleted_at）
CREATE TABLE aido.attendance_records (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES aido.users(id),
  work_date DATE NOT NULL,
  clock_in_at TIMESTAMPTZ,
  clock_out_at TIMESTAMPTZ,
  source TEXT DEFAULT 'web',
  location_lat NUMERIC(10,7),
  location_lng NUMERIC(11,7),
  ip_address TEXT,
  device_id TEXT,
  schedule_id BIGINT REFERENCES aido.schedules(id),
  normal_minutes INTEGER DEFAULT 0,
  overtime_minutes INTEGER DEFAULT 0,
  late_minutes INTEGER DEFAULT 0,
  early_leave_minutes INTEGER DEFAULT 0,
  missing_punch BOOLEAN DEFAULT FALSE,
  immutable_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, work_date)
);
CREATE INDEX idx_aido_attendance_date ON aido.attendance_records(work_date);

CREATE TABLE aido.attendance_corrections (
  id BIGSERIAL PRIMARY KEY,
  request_id BIGINT REFERENCES aido.requests(id),
  attendance_record_id BIGINT REFERENCES aido.attendance_records(id),
  correction_type TEXT,
  proposed_clock_in_at TIMESTAMPTZ,
  proposed_clock_out_at TIMESTAMPTZ,
  reason TEXT,
  approved_by_user_id BIGINT REFERENCES aido.users(id),
  applied_at TIMESTAMPTZ
);

CREATE TABLE aido.overtime_records (
  id BIGSERIAL PRIMARY KEY,
  request_id BIGINT REFERENCES aido.requests(id),
  user_id BIGINT NOT NULL REFERENCES aido.users(id),
  work_date DATE,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  minutes INTEGER DEFAULT 0,
  day_type TEXT DEFAULT 'workday',
  estimated_pay NUMERIC(10,2) DEFAULT 0,
  convert_to_comp_time BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'pending'
);

-- ============ 1.6 薪資 ============

CREATE TABLE aido.payroll_runs (
  id BIGSERIAL PRIMARY KEY,
  run_no TEXT UNIQUE NOT NULL,
  period_start DATE,
  period_end DATE,
  pay_date DATE,
  status TEXT DEFAULT 'draft',
  created_by_user_id BIGINT REFERENCES aido.users(id),
  gross_total NUMERIC(14,2) DEFAULT 0,
  net_total NUMERIC(14,2) DEFAULT 0,
  employer_contribution_total NUMERIC(14,2) DEFAULT 0,
  rule_snapshot_json TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 法定不可刪
CREATE TABLE aido.payslips (
  id BIGSERIAL PRIMARY KEY,
  payroll_run_id BIGINT NOT NULL REFERENCES aido.payroll_runs(id),
  user_id BIGINT NOT NULL REFERENCES aido.users(id),
  base_salary NUMERIC(14,2) DEFAULT 0,
  allowance_total NUMERIC(14,2) DEFAULT 0,
  overtime_pay NUMERIC(14,2) DEFAULT 0,
  bonus NUMERIC(14,2) DEFAULT 0,
  leave_deduction NUMERIC(14,2) DEFAULT 0,
  labor_insurance NUMERIC(14,2) DEFAULT 0,
  health_insurance NUMERIC(14,2) DEFAULT 0,
  pension_employee NUMERIC(14,2) DEFAULT 0,
  pension_employer NUMERIC(14,2) DEFAULT 0,
  tax_withholding NUMERIC(14,2) DEFAULT 0,
  supplementary_premium NUMERIC(14,2) DEFAULT 0,
  gross_pay NUMERIC(14,2) DEFAULT 0,
  total_deductions NUMERIC(14,2) DEFAULT 0,
  net_pay NUMERIC(14,2) DEFAULT 0,
  detail_json TEXT,
  published_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  UNIQUE(payroll_run_id, user_id)
);
CREATE INDEX idx_aido_payslip_user ON aido.payslips(user_id);

-- ============ 1.7 資產/合約/公告/知識庫 ============

CREATE TABLE aido.assets (
  id BIGSERIAL PRIMARY KEY,
  asset_no TEXT UNIQUE,
  name TEXT NOT NULL,
  category TEXT,
  status TEXT DEFAULT 'available',
  assigned_to_user_id BIGINT REFERENCES aido.users(id),
  department_id BIGINT REFERENCES aido.departments(id),
  purchase_date DATE,
  purchase_amount NUMERIC(14,2),
  vendor TEXT,
  warranty_until DATE,
  location TEXT,
  serial_no TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_aido_assets_assignee ON aido.assets(assigned_to_user_id);

CREATE TABLE aido.contracts (
  id BIGSERIAL PRIMARY KEY,
  contract_no TEXT UNIQUE,
  title TEXT NOT NULL,
  party_name TEXT,
  owner_user_id BIGINT REFERENCES aido.users(id),
  department_id BIGINT REFERENCES aido.departments(id),
  contract_type TEXT,
  status TEXT DEFAULT 'draft',
  start_date DATE,
  end_date DATE,
  amount NUMERIC(14,2),
  currency TEXT DEFAULT 'TWD',
  file_id BIGINT,
  request_id BIGINT REFERENCES aido.requests(id),
  renewal_notice_days INTEGER DEFAULT 30,
  confidential_level TEXT DEFAULT 'normal',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE aido.announcements (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT,
  audience_json TEXT,
  publish_at TIMESTAMPTZ,
  expire_at TIMESTAMPTZ,
  created_by_user_id BIGINT REFERENCES aido.users(id),
  status TEXT DEFAULT 'published',
  require_ack BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE aido.knowledge_docs (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT,
  content TEXT,
  visibility_json TEXT,
  status TEXT DEFAULT 'published',
  owner_user_id BIGINT REFERENCES aido.users(id),
  version INTEGER DEFAULT 1,
  tags_json TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============ 1.8 業務表 ============

CREATE TABLE aido.benefit_claims (
  id BIGSERIAL PRIMARY KEY,
  request_id BIGINT REFERENCES aido.requests(id),
  user_id BIGINT NOT NULL REFERENCES aido.users(id),
  benefit_type TEXT,
  amount NUMERIC(14,2),
  status TEXT DEFAULT 'draft',
  proof_file_id BIGINT
);

CREATE TABLE aido.er_cases (
  id BIGSERIAL PRIMARY KEY,
  case_no TEXT UNIQUE,
  case_type TEXT,
  reporter_user_id BIGINT REFERENCES aido.users(id),
  target_user_id BIGINT REFERENCES aido.users(id),
  owner_hr_user_id BIGINT REFERENCES aido.users(id),
  status TEXT DEFAULT 'open',
  severity TEXT DEFAULT 'low',
  summary TEXT,
  confidential_notes TEXT,
  opened_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE aido.headcount (
  id BIGSERIAL PRIMARY KEY,
  department_id BIGINT NOT NULL REFERENCES aido.departments(id),
  position_id BIGINT REFERENCES aido.positions(id),
  fiscal_year INTEGER NOT NULL,
  planned_count INTEGER DEFAULT 0,
  actual_count INTEGER DEFAULT 0,
  open_count INTEGER DEFAULT 0,
  budget_amount NUMERIC(14,2) DEFAULT 0,
  status TEXT DEFAULT 'draft',
  approved_request_id BIGINT REFERENCES aido.requests(id),
  UNIQUE(department_id, position_id, fiscal_year)
);

CREATE TABLE aido.personnel_changes (
  id BIGSERIAL PRIMARY KEY,
  request_id BIGINT REFERENCES aido.requests(id),
  user_id BIGINT NOT NULL REFERENCES aido.users(id),
  change_type TEXT,
  effective_date DATE,
  old_department_id BIGINT REFERENCES aido.departments(id),
  new_department_id BIGINT REFERENCES aido.departments(id),
  old_position_id BIGINT REFERENCES aido.positions(id),
  new_position_id BIGINT REFERENCES aido.positions(id),
  old_manager_user_id BIGINT REFERENCES aido.users(id),
  new_manager_user_id BIGINT REFERENCES aido.users(id),
  reason TEXT,
  applied_at TIMESTAMPTZ
);

CREATE TABLE aido.compensation_changes (
  id BIGSERIAL PRIMARY KEY,
  request_id BIGINT REFERENCES aido.requests(id),
  user_id BIGINT NOT NULL REFERENCES aido.users(id),
  effective_date DATE,
  old_base_salary_encrypted TEXT,
  new_base_salary_encrypted TEXT,
  change_amount NUMERIC(14,2),
  change_percent NUMERIC(6,2),
  reason TEXT,
  initiated_by_user_id BIGINT REFERENCES aido.users(id),
  applied_at TIMESTAMPTZ
);

CREATE TABLE aido.expense_claims (
  id BIGSERIAL PRIMARY KEY,
  request_id BIGINT REFERENCES aido.requests(id),
  user_id BIGINT NOT NULL REFERENCES aido.users(id),
  expense_date DATE,
  category TEXT,
  amount NUMERIC(14,2),
  currency TEXT DEFAULT 'TWD',
  tax_id TEXT,
  receipt_file_id BIGINT,
  payment_status TEXT DEFAULT 'unpaid',
  paid_at TIMESTAMPTZ
);

CREATE TABLE aido.purchase_orders (
  id BIGSERIAL PRIMARY KEY,
  request_id BIGINT REFERENCES aido.requests(id),
  requester_user_id BIGINT NOT NULL REFERENCES aido.users(id),
  vendor TEXT,
  category TEXT,
  amount NUMERIC(14,2),
  budget_code TEXT,
  status TEXT DEFAULT 'requested',
  expected_delivery_date DATE
);

CREATE TABLE aido.seal_requests (
  id BIGSERIAL PRIMARY KEY,
  request_id BIGINT REFERENCES aido.requests(id),
  requester_user_id BIGINT NOT NULL REFERENCES aido.users(id),
  seal_type TEXT,
  document_title TEXT,
  purpose TEXT,
  counterparty TEXT,
  file_id BIGINT,
  legal_required BOOLEAN DEFAULT FALSE,
  sealed_by_user_id BIGINT REFERENCES aido.users(id),
  sealed_at TIMESTAMPTZ
);

CREATE TABLE aido.it_tickets (
  id BIGSERIAL PRIMARY KEY,
  ticket_no TEXT UNIQUE,
  requester_user_id BIGINT NOT NULL REFERENCES aido.users(id),
  assignee_user_id BIGINT REFERENCES aido.users(id),
  category TEXT,
  priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'open',
  subject TEXT,
  description TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE aido.onboarding_cases (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES aido.users(id),
  case_type TEXT DEFAULT 'onboarding',
  owner_hr_user_id BIGINT REFERENCES aido.users(id),
  start_date DATE,
  target_date DATE,
  status TEXT DEFAULT 'active',
  checklist_json TEXT,
  related_request_id BIGINT REFERENCES aido.requests(id)
);

CREATE TABLE aido.offboarding_cases (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES aido.users(id),
  case_type TEXT DEFAULT 'offboarding',
  owner_hr_user_id BIGINT REFERENCES aido.users(id),
  start_date DATE,
  target_date DATE,
  status TEXT DEFAULT 'active',
  checklist_json TEXT,
  related_request_id BIGINT REFERENCES aido.requests(id)
);

CREATE TABLE aido.performance_reviews (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES aido.users(id),
  reviewer_user_id BIGINT REFERENCES aido.users(id),
  period TEXT,
  type TEXT DEFAULT 'KPI',
  score NUMERIC(5,2),
  status TEXT DEFAULT 'draft',
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE aido.training_records (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES aido.users(id),
  course_name TEXT,
  category TEXT,
  status TEXT DEFAULT 'enrolled',
  completed_at TIMESTAMPTZ,
  hours NUMERIC(6,1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE aido.candidates (
  id BIGSERIAL PRIMARY KEY,
  name TEXT,
  position_applied TEXT,
  department_id BIGINT REFERENCES aido.departments(id),
  stage TEXT DEFAULT 'applied',
  source TEXT,
  rating NUMERIC(3,1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE aido.compliance_checks (
  id BIGSERIAL PRIMARY KEY,
  check_type TEXT,
  subject TEXT,
  severity TEXT DEFAULT 'low',
  status TEXT DEFAULT 'open',
  detail TEXT,
  related_user_id BIGINT REFERENCES aido.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE aido.ai_form_drafts (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES aido.users(id),
  module_code TEXT,
  form_code TEXT,
  user_prompt TEXT,
  extracted_json TEXT,
  confidence_json TEXT,
  missing_fields_json TEXT,
  risk_flags_json TEXT,
  status TEXT DEFAULT 'draft',
  request_id BIGINT REFERENCES aido.requests(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Grant all tables to service_role (needed for server-side access)
GRANT ALL ON ALL TABLES IN SCHEMA aido TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA aido TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA aido TO authenticated;
