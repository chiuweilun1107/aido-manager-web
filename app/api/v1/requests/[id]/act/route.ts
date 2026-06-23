import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { authBearerUser, jsonCors, preflight } from '@/lib/agent-auth'
import { act } from '@/lib/bpm'

export async function OPTIONS(req: NextRequest) { return preflight(req) }

/** POST：使用者 JWT → 以本人身分簽核(approve/reject/return)或取消(cancel)。
 *  身分/權限由 bpm.act() 內部驗證(必須是現任簽核人或申請人)，零繞過。 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await authBearerUser(req)
  if (!user) return jsonCors(req, { error: 'Unauthorized' }, { status: 401 })

  let body: { action?: string; comment?: string }
  try { body = await req.json() } catch { return jsonCors(req, { error: '無效的 JSON' }, { status: 400 }) }
  const { action, comment } = body
  if (!action || !['approve', 'reject', 'return', 'cancel'].includes(action)) {
    return jsonCors(req, { error: 'Invalid action' }, { status: 400 })
  }

  const svc = createServiceClient()
  try {
    const result = await act(svc, user, Number(id), action, comment || null, {
      ip: req.headers.get('x-forwarded-for') || undefined,
      ua: req.headers.get('user-agent') || undefined,
    })
    return jsonCors(req, { ok: true, request: result })
  } catch (e) {
    return jsonCors(req, { error: (e as Error).message }, { status: 400 })
  }
}
