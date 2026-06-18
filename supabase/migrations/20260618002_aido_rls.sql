-- AiDo RLS: revoke broad authenticated access, enable RLS on all aido tables
-- All app data access goes through Next.js API routes using service_role (bypasses RLS)
-- This prevents direct PostgREST/Supabase client access to sensitive data

-- Revoke the overly broad grant from migration 001
REVOKE SELECT ON ALL TABLES IN SCHEMA aido FROM authenticated;
REVOKE SELECT ON ALL TABLES IN SCHEMA aido FROM anon;

-- Enable RLS on all sensitive tables
ALTER TABLE aido.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE aido.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE aido.requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE aido.approval_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE aido.approval_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE aido.payslips ENABLE ROW LEVEL SECURITY;
ALTER TABLE aido.payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE aido.compensation_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE aido.leave_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE aido.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE aido.er_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE aido.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE aido.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE aido.personnel_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE aido.expense_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE aido.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE aido.seal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE aido.benefit_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE aido.headcount ENABLE ROW LEVEL SECURITY;
ALTER TABLE aido.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE aido.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE aido.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE aido.knowledge_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE aido.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE aido.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE aido.positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE aido.leave_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE aido.form_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE aido.overtime_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE aido.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE aido.attendance_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE aido.user_delegates ENABLE ROW LEVEL SECURITY;
ALTER TABLE aido.user_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE aido.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE aido.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE aido.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE aido.compliance_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE aido.it_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE aido.onboarding_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE aido.offboarding_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE aido.performance_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE aido.training_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE aido.ai_form_drafts ENABLE ROW LEVEL SECURITY;

-- No permissive policies for authenticated/anon — all access via service_role API routes
-- service_role always bypasses RLS (Supabase default behaviour)

-- Keep service_role grants for server-side operations
GRANT ALL ON ALL TABLES IN SCHEMA aido TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA aido TO service_role;

-- Default privileges: future tables also get service_role access automatically
ALTER DEFAULT PRIVILEGES IN SCHEMA aido GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA aido GRANT ALL ON SEQUENCES TO service_role;
