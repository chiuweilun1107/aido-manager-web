import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { authBearerUser, jsonCors, preflight } from '@/lib/agent-auth'
import { addStep } from '@/lib/bpm'
import { maskRequestForViewer } from '@/lib/self-service'

export async function OPTIONS(req: NextRequest) { return preflight(req) }

/** POST：使用者 JWT → 加簽。權限由 bpm.addStep() 驗證(僅現任簽核人可加簽)。 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await authBearerUser(req)
  if (!user) return jsonCors(req, { error: 'Unauthorized' }, { status: 401 })

  let opts: Record<string, unknown>
  try { opts = await req.json() } catch { return jsonCors(req, { error: '無效的 JSON' }, { status: 400 }) }

  const svc = createServiceClient()
  try {
    const result = await addStep(svc, user, Number(id), opts)
    return jsonCors(req, { ok: true, request: await maskRequestForViewer(svc, user, result) })
  } catch (e) {
    return jsonCors(req, { error: (e as Error).message }, { status: 400 })
  }
}
