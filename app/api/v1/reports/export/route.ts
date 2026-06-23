import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { authBearerUser, jsonCors, preflight, corsHeaders } from '@/lib/agent-auth'
import { getReportCsv } from '@/lib/self-service'

export async function OPTIONS(req: NextRequest) { return preflight(req) }

/** GET：使用者 JWT → 公司級申請單 CSV 匯出(company-scoped)。 */
export async function GET(req: NextRequest) {
  const user = await authBearerUser(req)
  if (!user) return jsonCors(req, { error: 'Unauthorized' }, { status: 401 })
  const svc = createServiceClient()
  const csv = await getReportCsv(svc, user)
  return new NextResponse(csv, {
    headers: {
      ...corsHeaders(req),
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="aido-requests-report.csv"`,
    },
  })
}
