import { NextResponse } from 'next/server'
import { getAuthContext, jsonError } from '@/lib/auth'
import { createGatewayBillService, GatewayError } from '@/lib/services/gateway.service'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ leaseId: string }> }
) {
  const auth = await getAuthContext(req)
  if (!auth) {
    return jsonError('Unauthorized', 401)
  }

  const { leaseId } = await params

  try {
    const result = await createGatewayBillService(auth, leaseId)
    return NextResponse.json(result, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof GatewayError) {
      return jsonError(err.message, err.statusCode)
    }
    const message = err instanceof Error ? err.message : 'Internal error'
    return jsonError(message, 500)
  }
}

