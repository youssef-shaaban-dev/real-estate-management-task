import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthContext, jsonError } from '@/lib/auth'
import { generateSchedule } from '@/lib/billing'
import { Prisma } from '@/generated/prisma/client'

interface CreateLeaseBody {
  unitId: string
  tenantId: string
  startDate: string
  endDate: string
  monthlyRentSen: number
  depositSen: number
}

export async function POST(req: Request) {
  // 1. Authenticate and enforce manager role
  const auth = await getAuthContext(req)
  if (!auth) {
    return jsonError('Unauthorized', 401)
  }
  if (auth.role !== 'manager') {
    return jsonError('Forbidden: only managers can create leases', 403)
  }

  // 2. Parse and validate JSON input
  let body: CreateLeaseBody
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

  // 3. Verify unitId and tenantId belong to the caller's organization (return 404 to avoid leaking cross-org data)
  const unit = await prisma.unit.findFirst({
    where: { id: unitId, orgId: auth.orgId },
  })
  if (!unit) {
    return jsonError('Unit not found', 404)
  }

  const tenant = await prisma.tenant.findFirst({
    where: { id: tenantId, orgId: auth.orgId },
  })
  if (!tenant) {
    return jsonError('Tenant not found', 404)
  }

  // 4. Generate billing schedule using pure billing rules
  let schedule
  try {
    schedule = generateSchedule({
      startDate,
      endDate,
      monthlyRentSen,
      depositSen,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Invalid lease dates or amounts'
    return jsonError(message, 400)
  }

  // 5. Atomic transaction: serialize on unit, check overlap, insert lease + invoices + audit_log
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Row-level lock on the unit to serialize concurrent lease creation on the same unit
      await tx.$executeRaw`SELECT id FROM units WHERE id = ${unitId}::uuid FOR UPDATE`

      // Explicit check for overlapping leases on this unit
      // Both start_date and end_date are inclusive
      const overlapping = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM leases
        WHERE unit_id = ${unitId}::uuid
          AND daterange(start_date, end_date, '[]') && daterange(${startDate}::date, ${endDate}::date, '[]')
        LIMIT 1
      `

      if (overlapping.length > 0) {
        throw new OverlapError('Lease overlaps with an existing lease on this unit')
      }

      // Create Lease
      const lease = await tx.lease.create({
        data: {
          orgId: auth.orgId,
          unitId,
          tenantId,
          startDate: new Date(`${startDate}T00:00:00.000Z`),
          endDate: new Date(`${endDate}T00:00:00.000Z`),
          monthlyRentSen: BigInt(monthlyRentSen),
          depositSen: BigInt(depositSen),
        },
      })

      // Create Invoices all-or-nothing
      await tx.invoice.createMany({
        data: schedule.map((inv) => ({
          orgId: auth.orgId,
          leaseId: lease.id,
          kind: inv.kind,
          periodIndex: inv.periodIndex,
          periodStart: inv.periodStart ? new Date(`${inv.periodStart}T00:00:00.000Z`) : null,
          periodEnd: inv.periodEnd ? new Date(`${inv.periodEnd}T00:00:00.000Z`) : null,
          dueDate: new Date(`${inv.dueDate}T00:00:00.000Z`),
          amountSen: BigInt(inv.amountSen),
        })),
      })

      // Audit Log
      await tx.auditLog.create({
        data: {
          orgId: auth.orgId,
          actorId: auth.userId,
          action: 'create_lease',
          entityId: lease.id,
          details: {
            unitId,
            tenantId,
            startDate,
            endDate,
            monthlyRentSen,
            depositSen,
            invoicesCount: schedule.length,
          },
        },
      })

      return lease
    })

    return NextResponse.json({ id: result.id }, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof OverlapError) {
      return jsonError(err.message, 409)
    }

    // Catch Postgres GiST exclusion constraint error (code 23P01 or Prisma raw violation)
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2002' || (err.meta && String(err.meta.target).includes('gist'))) {
        return jsonError('Lease overlaps with an existing lease on this unit', 409)
      }
    }

    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('conflicting key value violates exclusion constraint') || message.includes('23P01')) {
      return jsonError('Lease overlaps with an existing lease on this unit', 409)
    }

    console.error('Failed to create lease:', err)
    return jsonError('Internal server error', 500)
  }
}

class OverlapError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OverlapError'
  }
}

