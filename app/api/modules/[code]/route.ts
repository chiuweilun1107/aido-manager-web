import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { MODULE_MAP, visibleModules } from '@/lib/modules'
import { createAndSubmit } from '@/lib/bpm'

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const db = svc.schema('aido')
  const { data: aiDoUser } = await db.from('users').select('*, roles!users_primary_role_id_fkey(code)').eq('auth_user_id', user.id).single()
  if (!aiDoUser) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const roleCode = aiDoUser.roles?.code ?? 'employee'
  const mod = MODULE_MAP[code]
  if (!mod) return NextResponse.json({ error: 'Module not found' }, { status: 404 })
  if (!visibleModules(roleCode).find(m => m.code === code)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (mod.kind === 'request') {
    const { data } = await db.from('requests').select('*').eq('module_code', code).eq('requester_user_id', aiDoUser.id).order('created_at', { ascending: false }).limit(50)
    return NextResponse.json({ items: data || [], mod })
  }

  if (mod.kind === 'record' && mod.table) {
    const query = db.from(mod.table).select('*').order('created_at' as string, { ascending: false }).limit(50)
    const scopedRoles = ['employee', 'manager']
    const { data } = scopedRoles.includes(roleCode)
      ? await query.eq('user_id' as string, aiDoUser.id)
      : await query
    return NextResponse.json({ items: data || [], mod })
  }

  return NextResponse.json({ items: [], mod })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const db = svc.schema('aido')
  const { data: aiDoUser } = await db.from('users').select('*').eq('auth_user_id', user.id).single()
  if (!aiDoUser) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const mod = MODULE_MAP[code]
  if (!mod) return NextResponse.json({ error: 'Module not found' }, { status: 404 })

  const payload = await req.json()
  const ip = req.headers.get('x-forwarded-for') || undefined
  const ua = req.headers.get('user-agent') || undefined

  if (mod.kind === 'request') {
    const result = await createAndSubmit(svc, aiDoUser, code, payload, { ip, ua })
    return NextResponse.json({ ok: true, request: result })
  }

  if (mod.kind === 'record' && mod.table) {
    const { data, error } = await db.from(mod.table).insert({ ...payload, created_by_user_id: aiDoUser.id }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true, record: data })
  }

  return NextResponse.json({ error: 'Cannot create for this module type' }, { status: 400 })
}
