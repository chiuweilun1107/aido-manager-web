export interface AidoRole {
  id: number
  code: string
  name: string
  dashboard_route: string
  level: number
}

export interface AidoDepartment {
  id: number
  code: string | null
  name: string
  parent_id: number | null
  manager_user_id: number | null
  path: string | null
  status: string
}

export interface AidoUser {
  id: number
  auth_user_id: string | null
  employee_no: string | null
  email: string
  display_name: string
  status: string
  primary_role_id: number | null
  department_id: number | null
  position_id: number | null
  manager_user_id: number | null
  hired_at: string | null
  locale: string
  timezone: string
  created_at: string
  // joined
  roles?: AidoRole
  departments?: AidoDepartment
}

export interface AidoRequest {
  id: number
  request_no: string
  module_code: string
  form_code: string
  requester_user_id: number
  requester_department_id: number | null
  title: string | null
  status: string
  current_step_no: number | null
  amount: number | null
  payload_json: string | null
  submitted_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
  // joined
  users?: AidoUser
  approval_steps?: AidoApprovalStep[]
}

export interface AidoApprovalStep {
  id: number
  request_id: number
  step_no: number
  step_type: string
  name: string | null
  approver_type: string | null
  approver_user_id: number | null
  approver_role_id: number | null
  required_mode: string
  status: string
  due_at: string | null
  started_at: string | null
  completed_at: string | null
}

export interface AidoApprovalAction {
  id: number
  request_id: number
  approval_step_id: number | null
  actor_user_id: number
  action: string
  comment: string | null
  from_status: string | null
  to_status: string | null
  created_at: string
  // joined
  users?: AidoUser
}

export interface SessionUser {
  authId: string
  id: number
  email: string
  displayName: string
  roleCode: string
  roleName: string
  departmentId: number | null
  departmentName: string | null
  managerId: number | null
  employeeNo: string | null
}
