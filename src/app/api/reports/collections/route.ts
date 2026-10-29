import { NextResponse } from 'next/server'
import { getAuthContext, jsonError } from '@/lib/auth'
import { getCollectionsReportService, ReportError } from '@/lib/services/report.service'

export async function GET(req: Request) {
  const auth = await getAuthContext(req)
  if (!auth) {
    return jsonError('Unauthorized', 401)
  }

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  try {
    const report = await getCollectionsReportService(auth, from, to)
    return NextResponse.json(report, { status: 200 })
  } catch (err: unknown) {
    if (err instanceof ReportError) {
      return jsonError(err.message, err.statusCode)
    }
    const message = err instanceof Error ? err.message : 'Internal error'
    return jsonError(message, 500)
  }
}

