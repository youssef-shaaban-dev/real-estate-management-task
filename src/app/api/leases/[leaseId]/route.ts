import { NextResponse } from 'next/server'
import { getAuthContext, jsonError } from '@/lib/auth'
import { getLeaseDetailsService, NotFoundError } from '@/lib/services/lease.service'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ leaseId: string }> }
) {
  const auth = await getAuthContext(req)
  if (!auth) {
    return jsonError('Unauthorized', 401)
  }

  const { leaseId } = await params

  try {
    const data = await getLeaseDetailsService(auth, leaseId)
    return NextResponse.json(data)
  } catch (err: unknown) {
    if (err instanceof NotFoundError) {
      return jsonError(err.message, 404)
    }
    const message = err instanceof Error ? err.message : 'Internal error'
    return jsonError(message, 500)
  }
}
