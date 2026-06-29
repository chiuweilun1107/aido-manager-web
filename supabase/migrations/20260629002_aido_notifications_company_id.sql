-- aido.notifications 補 company_id 欄位
-- bpm.ts (L305, L320) 與 sla-escalate/route.ts (L47) 均已 INSERT company_id，
-- 但原始 schema (20260618001) 建表時未加此欄位，正式環境 INSERT 會 422。
ALTER TABLE aido.notifications
  ADD COLUMN IF NOT EXISTS company_id BIGINT REFERENCES aido.companies(id);

CREATE INDEX IF NOT EXISTS idx_aido_notif_company
  ON aido.notifications(company_id, status);
