import { NextResponse } from 'next/server'
import { getAuthContext, jsonError } from '@/lib/auth'
import {
  recordPaymentService,
  PaymentError,
  RecordPaymentInput,
} from '@/lib/services/payment.service'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ leaseId: string }> }
) {
  const auth = await getAuthContext(req)
  if (!auth) {
    return jsonError('Unauthorized', 401)
  }

  const { leaseId } = await params

  let body: RecordPaymentInput
  try {
    body = await req.json()
  } catch {
    return jsonError('Invalid JSON input', 400)
  }

  // Support idempotency key from header or body
  const headerKey = req.headers.get('idempotency-key')
  const idempotencyKey = headerKey || body.idempotencyKey

  try {
    const result = await recordPaymentService(auth, leaseId, {
      ...body,
      idempotencyKey,
    })
    return NextResponse.json(result, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof PaymentError) {
      return jsonError(err.message, err.statusCode)
    }
    const message = err instanceof Error ? err.message : 'Internal server error'
    return jsonError(message, 500)
  }
}

