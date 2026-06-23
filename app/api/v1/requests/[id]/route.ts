import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { authBearerUser, jsonCors, preflight } from '@/lib/agent-auth'
import { getRequestDetail } from '@/lib/self-service'

export async function OPTIONS(req: NextRequest) { return preflight(req) }

/** GET：使用者 JWT → 單據詳情 + 簽核步驟 + 簽核軌跡（self / approver / 特權角色可看，與後台一致）。 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await authBearerUser(req)
  if (!user) return jsonCors(req, { error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const r = await getRequestDetail(svc, user, Number(id))
  if (!r.ok) {
    if (r.error === 'notfound') return jsonCors(req, { error: 'Request not found' }, { status: 404 })
    return jsonCors(req, { error: 'Forbidden' }, { status: 403 })
  }
  return jsonCors(req, r.data)
}
