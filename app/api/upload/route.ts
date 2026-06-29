import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { uploadFile } from '@/lib/storage'

const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif',
  'application/pdf',
])

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const svc = createServiceClient()
  const db = svc.schema('aido')
  const { data: aiDoUser } = await db.from('users').select('id, company_id').eq('auth_user_id', user.id).single()
  if (!aiDoUser) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: '未選擇檔案' }, { status: 400 })
  if (!ALLOWED_MIME.has(file.type)) return NextResponse.json({ error: '不支援的檔案格式（僅接受圖片與 PDF）' }, { status: 415 })
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: '檔案不可超過 10MB' }, { status: 400 })

  const companyId = aiDoUser.company_id ?? 1
  const buf = Buffer.from(await file.arrayBuffer())
  let path: string, size: number
  try {
    const r = await uploadFile({ companyId, userId: aiDoUser.id, fileName: file.name, contentType: file.type, body: buf })
    path = r.path; size = r.size
  } catch (e) {
    return NextResponse.json({ error: '上傳失敗：' + (e as Error).message }, { status: 500 })
  }
  const { data, error } = await db.from('user_files').insert({
    company_id: companyId, owner_user_id: aiDoUser.id, file_name: file.name,
    file_path: path, mime_type: file.type, size_bytes: size, category: 'attachment',
  }).select('id').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true, fileId: data.id, fileName: file.name })
}
