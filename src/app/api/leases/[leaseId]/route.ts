import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthContext, jsonError } from '@/lib/auth'
import { invoiceStatus, InvoiceStatus } from '@/lib/billing'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ leaseId: string }> }
) {
  // 1. Authenticate caller
  const auth = await getAuthContext(req)
  if (!auth) {
    return jsonError('Unauthorized', 401)
  }

  const { leaseId } = await params

  // 2. Fetch the lease along with its invoices, allocations, and payments
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

  // 3. Security & Multitenancy checks:
  // - If lease doesn't exist OR belongs to another organization: 404 (do not reveal existence)
  // - If tenant requests a lease belonging to another tenant: 404 (do not reveal existence)
  if (!lease || lease.orgId !== auth.orgId) {
    return jsonError('Lease not found', 404)
  }

  if (auth.role === 'tenant' && lease.tenantId !== auth.tenantId) {
    return jsonError('Lease not found', 404)
  }

  const now = new Date()

  // 4. Sort invoices in strict allocation order:
  // First by due date, then deposit before rent, then period index
  const sortedInvoices = [...lease.invoices].sort((a, b) => {
    const dueA = a.dueDate.toISOString().slice(0, 10)
    const dueB = b.dueDate.toISOString().slice(0, 10)
    if (dueA !== dueB) {
      return dueA.localeCompare(dueB)
    }

    if (a.kind !== b.kind) {
      return a.kind === 'deposit' ? -1 : 1
    }

    const pA = a.periodIndex ?? -1
    const pB = b.periodIndex ?? -1
    return pA - pB
  })

  // 5. Format invoices with dynamic paidSen and computed status
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

  // 6. Format payments
  const formattedPayments = lease.payments.map((p) => ({
    id: p.id,
    amountSen: Number(p.amountSen),
    unappliedSen: Number(p.unappliedSen),
    method: p.method,
    status: p.status,
    receivedAt: p.receivedAt.toISOString(),
  }))

  // 7. Format lease
  const formattedLease = {
    id: lease.id,
    unitId: lease.unitId,
    tenantId: lease.tenantId,
    startDate: lease.startDate.toISOString().slice(0, 10),
    endDate: lease.endDate.toISOString().slice(0, 10),
    monthlyRentSen: Number(lease.monthlyRentSen),
    depositSen: Number(lease.depositSen),
  }

  return NextResponse.json({
    lease: formattedLease,
    invoices: formattedInvoices,
    payments: formattedPayments,
  })
}

