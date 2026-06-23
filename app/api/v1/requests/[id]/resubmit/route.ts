import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { authBearerUser, jsonCors, preflight } from '@/lib/agent-auth'
import { resubmit } from '@/lib/bpm'

export async function OPTIONS(req: NextRequest) { return preflight(req) }

/** POST：使用者 JWT → 退回後修改重送。權限由 bpm.resubmit() 驗證(僅申請人本人、status=returned)。 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await authBearerUser(req)
  if (!user) return jsonCors(req, { error: 'Unauthorized' }, { status: 401 })

  let body: { payload?: Record<string, unknown> }
  try { body = await req.json() } catch { return jsonCors(req, { error: '無效的 JSON' }, { status: 400 }) }

  const svc = createServiceClient()
  try {
    const result = await resubmit(svc, user, Number(id), body.payload ?? {})
    return jsonCors(req, { ok: true, request: result })
  } catch (e) {
    return jsonCors(req, { error: (e as Error).message }, { status: 400 })
  }
}
