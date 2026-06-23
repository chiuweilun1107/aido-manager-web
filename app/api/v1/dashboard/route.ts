import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { authBearerUser, jsonCors, preflight } from '@/lib/agent-auth'
import { getDashboard } from '@/lib/self-service'

export async function OPTIONS(req: NextRequest) { return preflight(req) }

/** GET：使用者 JWT → 個人儀表板(我的近 5 單、待簽數、公告、假期餘額、今日打卡)。 */
export async function GET(req: NextRequest) {
  const user = await authBearerUser(req)
  if (!user) return jsonCors(req, { error: 'Unauthorized' }, { status: 401 })
  const svc = createServiceClient()
  return jsonCors(req, await getDashboard(svc, user))
}
