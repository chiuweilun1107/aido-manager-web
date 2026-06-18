import { SupabaseClient } from '@supabase/supabase-js'

interface AuditParams {
  client: SupabaseClient
  actorUserId: number
  action: string
  entityType?: string
  entityId?: number
  moduleCode?: string
  before?: Record<string, unknown>
  after?: Record<string, unknown>
  ip?: string
  ua?: string
}

export async function audit({ client, actorUserId, action, entityType, entityId, moduleCode, before, after, ip, ua }: AuditParams) {
  try {
    await client.schema('aido').from('audit_logs').insert({
      actor_user_id: actorUserId,
      action,
      entity_type: entityType || null,
      entity_id: entityId || null,
      module_code: moduleCode || null,
      before_json: before ? JSON.stringify(before) : null,
      after_json: after ? JSON.stringify(after) : null,
      ip_address: ip || null,
      user_agent: ua || null
    })
  } catch { /* audit 不阻斷主流程 */ }
}
