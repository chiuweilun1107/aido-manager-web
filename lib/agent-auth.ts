import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/server'

// Agent 平台用的「使用者 JWT」認證 + CORS。
// 設計原則：跨來源的 agent app 帶「登入者自己的 Supabase access token」呼叫，
// agent 永遠 = 本人，受同樣 company/本人 scope 約束；絕不使用 service_role 當對外身分。

type AidoUserRow = Record<string, unknown>

/** 驗證 Authorization: Bearer <Supabase JWT> → 回 aido users row(含 company_id, roles.code)，無效回 null */
export async function authBearerUser(req: NextRequest): Promise<AidoUserRow | null> {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || ''
  if (!token || token.startsWith('aido_')) return null // 空，或那是對外 API key 不是使用者 JWT
  const sb = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
  const { data, error } = await sb.auth.getUser(token) // Supabase 驗 token 簽章/過期
  if (error || !data.user) return null
  const db = createServiceClient().schema('aido')
  const { data: aidoUser } = await db.from('users')
    .select('*, roles!users_primary_role_id_fkey(code)')
    .eq('auth_user_id', data.user.id).single()
  return (aidoUser as AidoUserRow) || null
}

/** CORS headers：agent app 跨來源呼叫。認證走 Authorization header(非 cookie)，反射 origin 安全 */
export function corsHeaders(req: NextRequest): Record<string, string> {
  const origin = req.headers.get('origin') || '*'
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  }
}

/** OPTIONS preflight 回應 */
export function preflight(req: NextRequest): NextResponse {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) })
}

/** 帶 CORS 的 JSON 回應 */
export function jsonCors(req: NextRequest, body: unknown, init?: { status?: number }): NextResponse {
  return NextResponse.json(body, { status: init?.status ?? 200, headers: corsHeaders(req) })
}

/** 解 helper：company id / role code */
export function companyOf(user: AidoUserRow): number { return Number(user.company_id) || 1 }
export function roleOf(user: AidoUserRow): string {
  const r = user.roles as { code?: string } | null | undefined
  return r?.code ?? 'employee'
}
