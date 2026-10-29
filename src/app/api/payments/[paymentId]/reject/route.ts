import { NextResponse } from 'next/server'
import { getAuthContext, jsonError } from '@/lib/auth'
import { rejectPaymentService, PaymentError } from '@/lib/services/payment.service'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  const auth = await getAuthContext(req)
  if (!auth) {
    return jsonError('Unauthorized', 401)
  }

  const { paymentId } = await params

  let reason = ''
  try {
    const body = await req.json()
    reason = body.reason
  } catch {
    return jsonError('Invalid JSON input', 400)
  }

  try {
    const result = await rejectPaymentService(auth, paymentId, reason)
    return NextResponse.json(result, { status: 200 })
  } catch (err: unknown) {
    if (err instanceof PaymentError) {
      return jsonError(err.message, err.statusCode)
    }
    const message = err instanceof Error ? err.message : 'Internal server error'
    return jsonError(message, 500)
  }
}

