import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { uploadFile } from '@/lib/storage'
import { authBearerUser, preflight, jsonCors, companyOf } from '@/lib/agent-auth'

// Phase E: 給 agent app 跨來源用的 Bearer-JWT 版上傳 endpoint。
// 鏡像 app/api/upload/route.ts，唯一差異：身分來自 Authorization Bearer JWT（authBearerUser），
// 非 cookie session；owner/company 取自驗過的 user，service client 只在驗身分後做受 scope 限制的操作。

const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif',
  'application/pdf',
])

export async function OPTIONS(req: NextRequest) {
  return preflight(req)
}

export async function POST(req: NextRequest) {
  const user = await authBearerUser(req)
  if (!user) return jsonCors(req, { error: 'Unauthorized' }, { status: 401 })

  const companyId = companyOf(user)
  const userId = Number(user.id)

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return jsonCors(req, { error: '未選擇檔案' }, { status: 400 })
  if (!ALLOWED_MIME.has(file.type)) return jsonCors(req, { error: '不支援的檔案格式（僅接受圖片與 PDF）' }, { status: 415 })
  if (file.size > 10 * 1024 * 1024) return jsonCors(req, { error: '檔案不可超過 10MB' }, { status: 400 })

  const svc = createServiceClient()
  const db = svc.schema('aido')

  const buf = Buffer.from(await file.arrayBuffer())
  let path: string, size: number
  try {
    const r = await uploadFile({ companyId, userId, fileName: file.name, contentType: file.type, body: buf })
    path = r.path; size = r.size
  } catch (e) {
    return jsonCors(req, { error: '上傳失敗：' + (e as Error).message }, { status: 500 })
  }
  const { data, error } = await db.from('user_files').insert({
    company_id: companyId, owner_user_id: userId, file_name: file.name,
    file_path: path, mime_type: file.type, size_bytes: size, category: 'attachment',
  }).select('id').single()
  if (error) return jsonCors(req, { error: error.message }, { status: 400 })
  return jsonCors(req, { ok: true, fileId: data.id, fileName: file.name })
}
