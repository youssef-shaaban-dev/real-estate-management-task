import { NextResponse } from 'next/server'
import { getAuthContext, jsonError } from '@/lib/auth'
import { ROLES } from '@/lib/constants'
import {
  createLeaseService,
  CreateLeaseInput,
  NotFoundError,
  OverlapError,
  ValidationError,
} from '@/lib/services/lease.service'

export async function POST(req: Request) {
  const auth = await getAuthContext(req)
  if (!auth) {
    return jsonError('Unauthorized', 401)
  }
  if (auth.role !== ROLES.MANAGER) {
    return jsonError('Forbidden: only managers can create leases', 403)
  }

  let body: CreateLeaseInput
  try {
    body = await req.json()
  } catch {
    return jsonError('Invalid JSON input', 400)
  }

  const { unitId, tenantId, startDate, endDate, monthlyRentSen, depositSen } = body
  if (
    !unitId ||
    !tenantId ||
    !startDate ||
    !endDate ||
    typeof monthlyRentSen !== 'number' ||
    typeof depositSen !== 'number'
  ) {
    return jsonError('Missing or invalid lease parameters', 400)
  }

  try {
    const lease = await createLeaseService(auth, body)
    return NextResponse.json({ id: lease.id }, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof NotFoundError) {
      return jsonError(err.message, 404)
    }
    if (err instanceof OverlapError) {
      return jsonError(err.message, 409)
    }
    if (err instanceof ValidationError) {
      return jsonError(err.message, 400)
    }
    const message = err instanceof Error ? err.message : 'Invalid request'
    return jsonError(message, 400)
  }
}
