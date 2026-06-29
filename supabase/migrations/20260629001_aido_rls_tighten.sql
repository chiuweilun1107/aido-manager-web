-- AiDo 智行 — RLS 收斂 (兜底層 / defense-in-depth)
-- ============================================================================
-- 背景：
--   核心 RLS 已存在於前面的 migration，不要重複 enable：
--     - 20260618002_aido_rls.sql      → 對全部業務表 ENABLE RLS（無 policy = 預設 deny）
--     - 20260622002_aido_platform.sql → 加 aido.current_company_id() + company_isolation
--                                        policy（FOR ALL TO authenticated USING company_id 隔離）
--   但其後新增的 4 張表，policy 寫成過寬的 `USING (true)`（svc_all_*），
--   形同對 authenticated/anon 也放行全部 row（跨租戶可讀）：
--     - 20260623001_aido_admin_config.sql → role_permissions / role_field_access /
--                                            approval_chain_templates
--     - 20260623002_aido_menu_groups.sql  → menu_groups
--   本 migration 把這 4 張表的 policy 收斂成與其他表一致的 company_isolation。
--
-- 重要（套用前務必理解）：
--   1. App server 端一律走 service_role client（lib/supabase/server.ts 的 createServiceClient），
--      service_role 「永遠 bypass RLS」（Supabase 預設），故收斂 policy 不影響後端任何查詢。
--      → 這層 policy 只擋「拿 anon/authenticated key 直連 PostgREST」想跨租戶竊資料的情境。
--   2. authenticated 直連時，company_isolation 需要 auth.uid() 能對應到 aido.users 的一筆 row
--      才解得到 current_company_id()；若你的前端「沒有」任何 authenticated 直連用法，
--      此 policy 等同把這些表對 anon/authenticated 全鎖（只剩 service_role 能讀）——這正是期望行為。
--   3. 套用前請先在 staging 驗證：跑一輪登入 / 開單 / 簽核 / admin 設定，
--      確認沒有任何路徑誤用 anon/authenticated client 直查這些表而被鎖死。
--      （理論上不會，因 app 全走 service client；但仍請實測再上 production。）
--
-- 套用方式（Allen 手動）：
--   supabase db push   或   psql -f 此檔
-- ============================================================================

-- 確保 helper 存在（與 20260622002 同定義，冪等；萬一只套了部分 migration 也安全）
CREATE OR REPLACE FUNCTION aido.current_company_id() RETURNS BIGINT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = aido AS $fn$
  SELECT company_id FROM aido.users WHERE auth_user_id = auth.uid() LIMIT 1
$fn$;

-- ============ 1. 收斂 4 張過寬 policy 的表 → company_isolation ============
DO $$
DECLARE
  t TEXT;
  late_tbls TEXT[] := ARRAY[
    'role_permissions', 'role_field_access', 'approval_chain_templates', 'menu_groups'
  ];
BEGIN
  FOREACH t IN ARRAY late_tbls LOOP
    -- 確保 RLS 開著（這些表原 migration 已 enable，冪等再保險）
    EXECUTE format('ALTER TABLE aido.%I ENABLE ROW LEVEL SECURITY', t);
    -- 移除過寬的 USING(true) policy
    EXECUTE format('DROP POLICY IF EXISTS svc_all_role_perm ON aido.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS svc_all_role_field ON aido.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS svc_all_chain_tmpl ON aido.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS svc_all_menu_groups ON aido.%I', t);
    -- 換上與其他表一致的 company 隔離 policy（authenticated 僅能存取自己 company 的 row）
    EXECUTE format('DROP POLICY IF EXISTS company_isolation ON aido.%I', t);
    EXECUTE format(
      'CREATE POLICY company_isolation ON aido.%I FOR ALL TO authenticated USING (company_id = aido.current_company_id())',
      t
    );
  END LOOP;
END $$;

-- ============ 2. 兜底：對所有業務表「補上缺漏的 company_isolation」 ============
-- 涵蓋全部業務表；對「已 ENABLE RLS 但漏 company_isolation policy」者補齊。
-- 全部冪等（先 DROP POLICY IF EXISTS 再 CREATE），重跑安全。
-- 僅針對「確定有 company_id 欄位」的表（multitenant + platform + admin_config + menu_groups 已加）。
DO $$
DECLARE
  t TEXT;
  tbls TEXT[] := ARRAY[
    'roles','departments','positions','users','user_roles',
    'form_definitions','requests','approval_steps','approval_actions',
    'audit_logs','notifications','notification_preferences','user_profiles',
    'user_delegates','user_files','leave_types','leave_balances','schedules',
    'attendance_records','attendance_corrections','overtime_records',
    'payroll_runs','payslips','assets','contracts','announcements',
    'knowledge_docs','benefit_claims','er_cases','headcount',
    'personnel_changes','compensation_changes','expense_claims',
    'purchase_orders','seal_requests','it_tickets','onboarding_cases',
    'offboarding_cases','performance_reviews','training_records',
    'candidates','compliance_checks','ai_form_drafts','api_keys','webhooks',
    'role_permissions','role_field_access','approval_chain_templates','menu_groups'
  ];
  has_col BOOLEAN;
  exists_tbl BOOLEAN;
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    -- 表存在才處理（不同環境 schema 可能略有差異）
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'aido' AND table_name = t
    ) INTO exists_tbl;
    IF NOT exists_tbl THEN CONTINUE; END IF;

    -- 必須有 company_id 欄位才套 company 隔離 policy
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'aido' AND table_name = t AND column_name = 'company_id'
    ) INTO has_col;
    IF NOT has_col THEN CONTINUE; END IF;

    EXECUTE format('ALTER TABLE aido.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS company_isolation ON aido.%I', t);
    EXECUTE format(
      'CREATE POLICY company_isolation ON aido.%I FOR ALL TO authenticated USING (company_id = aido.current_company_id())',
      t
    );
  END LOOP;
END $$;

-- companies 表本身：authenticated 只能看自己那筆（冪等，對齊 20260622002）
ALTER TABLE aido.companies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS company_self ON aido.companies;
CREATE POLICY company_self ON aido.companies FOR ALL TO authenticated USING (id = aido.current_company_id());

-- ============ 3. service_role 權限再確認（與 20260618002 對齊，冪等）============
GRANT ALL ON ALL TABLES IN SCHEMA aido TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA aido TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA aido GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA aido GRANT ALL ON SEQUENCES TO service_role;
