-- AiDo 智行 — 可自訂選單群組 + 表單可見角色
-- 讓 sidebar 大項目(group)可從 UI 新增/改名/排序，自訂表單能指派到群組並設定可見角色。

-- ============ 1. menu_groups：可自訂 sidebar 大項目 ============
CREATE TABLE IF NOT EXISTS aido.menu_groups (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL DEFAULT 1 REFERENCES aido.companies(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,   -- 系統預設群組(不可刪)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, code)
);
CREATE INDEX IF NOT EXISTS idx_aido_menu_groups_order ON aido.menu_groups(company_id, sort_order);

-- ============ 2. form_definitions：加 group_code(對應 menu_groups) + visible_roles ============
-- group_name(自由文字)保留向後相容；新 group_code 對應 menu_groups.code
ALTER TABLE aido.form_definitions ADD COLUMN IF NOT EXISTS group_code TEXT;
-- visible_roles：哪些 role 可見此自訂表單 (jsonb array of role_code)；空=全部可見
ALTER TABLE aido.form_definitions ADD COLUMN IF NOT EXISTS visible_roles JSONB DEFAULT '[]'::jsonb;

-- ============ 3. RLS (對齊現有；service client 走 code 層 filter) ============
ALTER TABLE aido.menu_groups ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='aido' AND tablename='menu_groups' AND policyname='svc_all_menu_groups') THEN
    CREATE POLICY svc_all_menu_groups ON aido.menu_groups FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
