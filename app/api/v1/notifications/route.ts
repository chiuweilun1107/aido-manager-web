import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { authBearerUser, jsonCors, preflight } from '@/lib/agent-auth'
import { listNotifications, markNotificationsRead } from '@/lib/self-service'

export async function OPTIONS(req: NextRequest) { return preflight(req) }

/** GET：使用者 JWT → 本人通知清單。 */
export async function GET(req: NextRequest) {
  const user = await authBearerUser(req)
  if (!user) return jsonCors(req, { error: 'Unauthorized' }, { status: 401 })
  const svc = createServiceClient()
  return jsonCors(req, { notifications: await listNotifications(svc, user) })
}

/** PATCH：使用者 JWT → 標記通知已讀(ids 指定則只標那些，否則全部未讀)。 */
export async function PATCH(req: NextRequest) {
  const user = await authBearerUser(req)
  if (!user) return jsonCors(req, { error: 'Unauthorized' }, { status: 401 })

  let body: { ids?: number[] }
  try { body = await req.json() } catch { body = {} }

  const svc = createServiceClient()
  await markNotificationsRead(svc, user, body.ids)
  return jsonCors(req, { ok: true })
}
