-- AiDo 智行 — 平台化 admin 可配置層
-- 目標：把寫死在 code 的「角色權限 / 簽核流程 / 表單欄位」搬進 DB，
-- 讓 admin 能從 UI 編輯，無需改 code 重新部署。多租戶 company_id。

-- ============ 1. role_permissions：每 role × module 的可見性 + 操作權限 + 讀範圍 ============
-- 取代 lib/rbac.ts 的 ROLE_ACTIONS / ROLE_READ_SCOPE + lib/modules.ts 的 roles_visible
CREATE TABLE IF NOT EXISTS aido.role_permissions (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL DEFAULT 1 REFERENCES aido.companies(id),
  role_code TEXT NOT NULL,
  module_code TEXT NOT NULL,
  visible BOOLEAN NOT NULL DEFAULT TRUE,             -- sidebar 是否顯示此 module
  actions JSONB NOT NULL DEFAULT '["read"]'::jsonb,  -- create/read/approve/manage/delete
  read_scope TEXT NOT NULL DEFAULT 'self',           -- self / team / all
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, role_code, module_code)
);
CREATE INDEX IF NOT EXISTS idx_aido_role_perm_lookup ON aido.role_permissions(company_id, role_code);

-- ============ 2. role_field_access：敏感欄位存取 (salary/national_id/bank_account…) ============
-- 取代 lib/rbac.ts 的 FIELD_FULL_ACCESS
CREATE TABLE IF NOT EXISTS aido.role_field_access (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL DEFAULT 1 REFERENCES aido.companies(id),
  role_code TEXT NOT NULL,
  field_key TEXT NOT NULL,
  allowed BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE(company_id, role_code, field_key)
);
CREATE INDEX IF NOT EXISTS idx_aido_role_field_lookup ON aido.role_field_access(company_id, role_code);

-- ============ 3. approval_chain_templates：簽核流程樣板 ============
-- 取代 lib/chains.ts 的 CHAINS；steps_json 格式 = ChainStep[] (bpm.ts expandSteps 直接吃)
CREATE TABLE IF NOT EXISTS aido.approval_chain_templates (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL DEFAULT 1 REFERENCES aido.companies(id),
  chain_code TEXT NOT NULL,
  name TEXT NOT NULL,
  module_code TEXT,
  amount_field TEXT DEFAULT 'amount',
  steps_json JSONB NOT NULL DEFAULT '[]'::jsonb,     -- [{step_no,name,type,condition,approver,required,sla_hours}]
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, chain_code)
);
CREATE INDEX IF NOT EXISTS idx_aido_chain_tmpl_lookup ON aido.approval_chain_templates(company_id, chain_code);

-- ============ 4. 啟用 form_definitions：用 fields_json (JSONB) 存表單欄位定義 ============
-- form_definitions 原有 schema_json/validation_json/approval_chain_json(TEXT) 未使用；
-- 新增 fields_json(JSONB) 存 ModuleField[]，並補 group/icon/title/chain_code 讓 module 可完全 DB-driven
ALTER TABLE aido.form_definitions ADD COLUMN IF NOT EXISTS fields_json JSONB DEFAULT '[]'::jsonb;
ALTER TABLE aido.form_definitions ADD COLUMN IF NOT EXISTS columns_json JSONB DEFAULT '[]'::jsonb;
ALTER TABLE aido.form_definitions ADD COLUMN IF NOT EXISTS chain_code TEXT;
ALTER TABLE aido.form_definitions ADD COLUMN IF NOT EXISTS icon TEXT;
ALTER TABLE aido.form_definitions ADD COLUMN IF NOT EXISTS group_name TEXT;
ALTER TABLE aido.form_definitions ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
ALTER TABLE aido.form_definitions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE aido.form_definitions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
-- form_definitions 已有 company_id (multitenant migration 回填)；補 upsert 用 unique
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_form_def_company_module_form') THEN
    ALTER TABLE aido.form_definitions ADD CONSTRAINT uq_form_def_company_module_form UNIQUE (company_id, module_code, form_code);
  END IF;
END $$;

-- ============ 5. RLS (對齊現有；app 走 service client 以 code 層 filter company_id，policy 為防線) ============
ALTER TABLE aido.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE aido.role_field_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE aido.approval_chain_templates ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='aido' AND tablename='role_permissions' AND policyname='svc_all_role_perm') THEN
    CREATE POLICY svc_all_role_perm ON aido.role_permissions FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='aido' AND tablename='role_field_access' AND policyname='svc_all_role_field') THEN
    CREATE POLICY svc_all_role_field ON aido.role_field_access FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='aido' AND tablename='approval_chain_templates' AND policyname='svc_all_chain_tmpl') THEN
    CREATE POLICY svc_all_chain_tmpl ON aido.approval_chain_templates FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
