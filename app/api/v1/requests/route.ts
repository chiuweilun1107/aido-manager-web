import { NextRequest } from 'next/server'
import { verifyApiKey } from '@/lib/apikey'
import { createServiceClient } from '@/lib/supabase/server'
import { createAndSubmit, createDraft } from '@/lib/bpm'
import { getEffectiveModule } from '@/lib/platform-config'
import { authBearerUser, companyOf, jsonCors, preflight } from '@/lib/agent-auth'

export async function OPTIONS(req: NextRequest) { return preflight(req) }

function parsePayload(r: Record<string, unknown>): Record<string, unknown> {
  try { return r.payload_json ? JSON.parse(String(r.payload_json)) : {} } catch { return {} }
}

/**
 * GET：
 *  - Bearer 是對外 API key(aido_...) → company-scoped 全公司單(既有行為，保留)
 *  - Bearer 是使用者 JWT → 只回「本人」的單；支援 ?module= & ?status= (供 relation 候選)
 */
export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || ''

  // 既有：對外 API key 路徑
  if (token.startsWith('aido_')) {
    const ctx = await verifyApiKey(token)
    if (!ctx) return jsonCors(req, { error: 'Invalid or missing API key' }, { status: 401 })
    const svc = createServiceClient()
    const { data } = await svc.schema('aido').from('requests')
      .select('id, request_no, module_code, title, status, amount, created_at')
      .eq('company_id', ctx.companyId).order('created_at', { ascending: false }).limit(100)
    return jsonCors(req, { data: data || [] })
  }

  // 新增：使用者 JWT → 本人單
  const user = await authBearerUser(req)
  if (!user) return jsonCors(req, { error: 'Unauthorized' }, { status: 401 })
  const companyId = companyOf(user)
  const svc = createServiceClient()
  const moduleParam = req.nextUrl.searchParams.get('module')
  const statusParam = req.nextUrl.searchParams.get('status')
  const statusFilter = statusParam ? statusParam.split(',').map(s => s.trim()).filter(Boolean) : []

  let q = svc.schema('aido').from('requests')
    .select('id, request_no, module_code, title, status, amount, payload_json, created_at')
    .eq('requester_user_id', user.id as number).eq('company_id', companyId)
  if (moduleParam) q = q.eq('module_code', moduleParam)
  if (statusFilter.length > 0) q = q.in('status', statusFilter)
  const { data } = await q.order('created_at', { ascending: false }).limit(50)

  const items = (data || []).map((r: Record<string, unknown>) => {
    const payload = parsePayload(r)
    const rest: Record<string, unknown> = { ...r }
    delete rest.payload_json
    return { ...rest, payload }
  })
  return jsonCors(req, { data: items })
}

/** POST：使用者 JWT → 以本人身分開單(走 createAndSubmit，後端驗證零繞過)，source='ai-agent' */
export async function POST(req: NextRequest) {
  const user = await authBearerUser(req)
  if (!user) return jsonCors(req, { error: 'Unauthorized' }, { status: 401 })

  let body: { module_code?: string; payload?: Record<string, unknown>; mode?: string }
  try { body = await req.json() } catch { return jsonCors(req, { error: '無效的 JSON' }, { status: 400 }) }
  const code = body.module_code
  const payload = body.payload ?? {}
  if (!code) return jsonCors(req, { error: 'module_code required' }, { status: 400 })

  const svc = createServiceClient()
  const mod = await getEffectiveModule(companyOf(user), code)
  if (!mod || mod.kind !== 'request') return jsonCors(req, { error: '模組不可開單: ' + code }, { status: 400 })

  const ip = req.headers.get('x-forwarded-for') || undefined
  const ua = req.headers.get('user-agent') || undefined

  // mode='draft'：只落地預填草稿(不驗必填、不展開簽核)，回 draft id 供前端導到 /module/<code>?draft=<id> 續編確認
  if (body.mode === 'draft') {
    try {
      const draft = await createDraft(svc, user, code, payload, { source: 'ai-agent' })
      return jsonCors(req, { ok: true, request: draft, draft: true })
    } catch (e) {
      const msg = e instanceof Error ? e.message : '草稿儲存失敗'
      return jsonCors(req, { error: msg }, { status: 400 })
    }
  }

  try {
    const result = await createAndSubmit(svc, user, code, payload, { source: 'ai-agent', ip, ua })
    return jsonCors(req, { ok: true, request: result })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '送出失敗'
    return jsonCors(req, { error: msg }, { status: 400 })
  }
}
