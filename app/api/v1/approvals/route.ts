import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { authBearerUser, jsonCors, preflight } from '@/lib/agent-auth'
import { listApprovals } from '@/lib/self-service'

export async function OPTIONS(req: NextRequest) { return preflight(req) }

/** GET：使用者 JWT → 待我簽核 + 我的申請。 */
export async function GET(req: NextRequest) {
  const user = await authBearerUser(req)
  if (!user) return jsonCors(req, { error: 'Unauthorized' }, { status: 401 })
  const svc = createServiceClient()
  return jsonCors(req, await listApprovals(svc, user))
}
