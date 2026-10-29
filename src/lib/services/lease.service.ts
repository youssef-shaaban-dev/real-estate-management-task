import { prisma } from '@/lib/prisma'
import { generateSchedule, invoiceStatus, InvoiceStatus } from '@/lib/billing'
import { AUDIT_ACTIONS, ROLES } from '@/lib/constants'
import { AuthContext } from '@/lib/auth'
import { Prisma } from '@/generated/prisma/client'

export class OverlapError extends Error {
  constructor(message: string = 'Lease overlaps with an existing lease on this unit') {
    super(message)
    this.name = 'OverlapError'
  }
}

export class NotFoundError extends Error {
  constructor(message: string = 'Record not found') {
    super(message)
    this.name = 'NotFoundError'
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

export interface CreateLeaseInput {
  unitId: string
  tenantId: string
  startDate: string
  endDate: string
  monthlyRentSen: number
  depositSen: number
}

/**
 * Creates a lease and its invoices in an atomic, concurrency-safe transaction.
 */
export async function createLeaseService(auth: AuthContext, input: CreateLeaseInput) {
  const { unitId, tenantId, startDate, endDate, monthlyRentSen, depositSen } = input

  // 1. Validate caller is manager
  if (auth.role !== ROLES.MANAGER) {
    throw new ValidationError('Forbidden: only managers can create leases')
  }

  // 2. Validate unit belongs to caller's org
  const unit = await prisma.unit.findFirst({
    where: { id: unitId, orgId: auth.orgId },
  })
  if (!unit) {
    throw new NotFoundError('Unit not found')
  }

  // 3. Validate tenant belongs to caller's org
  const tenant = await prisma.tenant.findFirst({
    where: { id: tenantId, orgId: auth.orgId },
  })
  if (!tenant) {
    throw new NotFoundError('Tenant not found')
  }

  // 4. Generate schedule
  const schedule = generateSchedule({
    startDate,
    endDate,
    monthlyRentSen,
    depositSen,
  })

  // 5. Execute atomic transaction
  try {
    return await prisma.$transaction(async (tx) => {
      // Row-level lock on the unit
      await tx.$executeRaw`SELECT id FROM units WHERE id = ${unitId}::uuid FOR UPDATE`

      // Overlap check
      const overlapping = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM leases
        WHERE unit_id = ${unitId}::uuid
          AND daterange(start_date, end_date, '[]') && daterange(${startDate}::date, ${endDate}::date, '[]')
        LIMIT 1
      `

      if (overlapping.length > 0) {
        throw new OverlapError()
      }

      // Insert lease
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

      // Insert invoices
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

      // Append to audit log
      await tx.auditLog.create({
        data: {
          orgId: auth.orgId,
          actorId: auth.userId,
          action: AUDIT_ACTIONS.CREATE_LEASE,
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
  } catch (err: unknown) {
    if (err instanceof OverlapError) {
      throw err
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2002' || (err.meta && String(err.meta.target).includes('gist'))) {
        throw new OverlapError()
      }
    }
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('conflicting key value violates exclusion constraint') || msg.includes('23P01')) {
      throw new OverlapError()
    }
    throw err
  }
}

/**
 * Retrieves a lease with dynamic invoice statuses and allocation ordering.
 */
export async function getLeaseDetailsService(auth: AuthContext, leaseId: string) {
  const lease = await prisma.lease.findUnique({
    where: { id: leaseId },
    include: {
      invoices: {
        include: {
          allocations: true,
        },
      },
      payments: true,
    },
  })

  // Multitenancy security checks
  if (!lease || lease.orgId !== auth.orgId) {
    throw new NotFoundError('Lease not found')
  }

  if (auth.role === ROLES.TENANT && lease.tenantId !== auth.tenantId) {
    throw new NotFoundError('Lease not found')
  }

  const now = new Date()

  // Sort invoices in allocation order: due date -> deposit before rent -> period index
  const sortedInvoices = [...lease.invoices].sort((a, b) => {
    const dueA = a.dueDate.toISOString().slice(0, 10)
    const dueB = b.dueDate.toISOString().slice(0, 10)
    if (dueA !== dueB) return dueA.localeCompare(dueB)

    if (a.kind !== b.kind) {
      return a.kind === 'deposit' ? -1 : 1
    }

    const pA = a.periodIndex ?? -1
    const pB = b.periodIndex ?? -1
    return pA - pB
  })

  const formattedInvoices = sortedInvoices.map((inv) => {
    const paidSen = inv.allocations.reduce((sum, alloc) => sum + Number(alloc.amountSen), 0)
    const dueDateStr = inv.dueDate.toISOString().slice(0, 10)
    const amountSen = Number(inv.amountSen)

    const status: InvoiceStatus = invoiceStatus(
      {
        dueDate: dueDateStr,
        amountSen,
        paidSen,
      },
      now
    )

    return {
      id: inv.id,
      kind: inv.kind,
      periodIndex: inv.periodIndex,
      periodStart: inv.periodStart ? inv.periodStart.toISOString().slice(0, 10) : null,
      periodEnd: inv.periodEnd ? inv.periodEnd.toISOString().slice(0, 10) : null,
      dueDate: dueDateStr,
      amountSen,
      paidSen,
      status,
    }
  })

  const formattedPayments = lease.payments.map((p) => ({
    id: p.id,
    amountSen: Number(p.amountSen),
    unappliedSen: Number(p.unappliedSen),
    method: p.method,
    status: p.status,
    receivedAt: p.receivedAt.toISOString(),
  }))

  const formattedLease = {
    id: lease.id,
    unitId: lease.unitId,
    tenantId: lease.tenantId,
    startDate: lease.startDate.toISOString().slice(0, 10),
    endDate: lease.endDate.toISOString().slice(0, 10),
    monthlyRentSen: Number(lease.monthlyRentSen),
    depositSen: Number(lease.depositSen),
  }

  return {
    lease: formattedLease,
    invoices: formattedInvoices,
    payments: formattedPayments,
  }
}
