import { NextRequest, NextResponse } from 'next/server'
import { requireAdminUser } from '@/lib/api-guard'
import { createServiceClient } from '@/lib/supabase/server'

// GET: 列該 company menu_groups (order by sort_order)
export async function GET() {
  const { user, error: authErr } = await requireAdminUser()
  if (authErr) return authErr

  const supabase = createServiceClient().schema('aido')
  const { data, error } = await supabase
    .from('menu_groups')
    .select('*')
    .eq('company_id', user.companyId)
    .order('sort_order', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ groups: data })
}

// POST: 新增群組 {code, name, sort_order}
export async function POST(req: NextRequest) {
  const { user, error: authErr } = await requireAdminUser()
  if (authErr) return authErr

  const body = await req.json()
  const { code, name, sort_order } = body

  if (!code || typeof code !== 'string' || !code.trim()) {
    return NextResponse.json({ error: 'code 為必填' }, { status: 400 })
  }
  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'name 為必填' }, { status: 400 })
  }

  const supabase = createServiceClient().schema('aido')
  const { data, error } = await supabase
    .from('menu_groups')
    .insert({
      company_id: user.companyId,
      code: code.trim(),
      name: name.trim(),
      sort_order: typeof sort_order === 'number' ? sort_order : 0,
      is_system: false,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: `代碼「${code}」已存在` }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ group: data }, { status: 201 })
}

// PUT: 編輯 {id, name, sort_order}
export async function PUT(req: NextRequest) {
  const { user, error: authErr } = await requireAdminUser()
  if (authErr) return authErr

  const body = await req.json()
  const { id, name, sort_order } = body

  if (!id) return NextResponse.json({ error: 'id 為必填' }, { status: 400 })

  // 驗證 company 歸屬
  const supabase = createServiceClient().schema('aido')
  const { data: existing, error: findErr } = await supabase
    .from('menu_groups')
    .select('id, company_id')
    .eq('id', id)
    .eq('company_id', user.companyId)
    .single()

  if (findErr || !existing) {
    return NextResponse.json({ error: '找不到群組或無權限' }, { status: 404 })
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof name === 'string' && name.trim()) updates.name = name.trim()
  if (typeof sort_order === 'number') updates.sort_order = sort_order

  const { data, error } = await supabase
    .from('menu_groups')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ group: data })
}

// DELETE: ?id= (擋 is_system=true)
export async function DELETE(req: NextRequest) {
  const { user, error: authErr } = await requireAdminUser()
  if (authErr) return authErr

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id 為必填' }, { status: 400 })

  const supabase = createServiceClient().schema('aido')
  const { data: existing, error: findErr } = await supabase
    .from('menu_groups')
    .select('id, company_id, is_system')
    .eq('id', id)
    .eq('company_id', user.companyId)
    .single()

  if (findErr || !existing) {
    return NextResponse.json({ error: '找不到群組或無權限' }, { status: 404 })
  }

  if (existing.is_system) {
    return NextResponse.json({ error: '系統群組不可刪除' }, { status: 400 })
  }

  const { error } = await supabase
    .from('menu_groups')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
