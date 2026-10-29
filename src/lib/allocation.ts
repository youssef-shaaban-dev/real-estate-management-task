import { Prisma } from '@/generated/prisma/client'
import { InvoiceKind, PaymentStatus } from '@/lib/constants'

const ZERO_BIGINT = BigInt(0)

/**
 * Allocates an approved payment to unpaid invoices for its lease.
 * Ordering: dueDate ASC -> deposit before rent -> periodIndex ASC.
 * Leftover funds are assigned to payment.unappliedSen.
 */
export async function allocate(
  tx: Prisma.TransactionClient,
  paymentId: string
): Promise<void> {
  const payment = await tx.payment.findUnique({
    where: { id: paymentId },
  })

  if (!payment || payment.status !== PaymentStatus.approved) {
    return
  }

  const invoices = await tx.invoice.findMany({
    where: { leaseId: payment.leaseId },
    include: { allocations: true },
  })

  // Order: dueDate -> deposit before rent -> periodIndex
  const sortedInvoices = invoices.sort((a, b) => {
    const dueA = a.dueDate.toISOString().slice(0, 10)
    const dueB = b.dueDate.toISOString().slice(0, 10)
    if (dueA !== dueB) return dueA.localeCompare(dueB)

    if (a.kind !== b.kind) {
      return a.kind === InvoiceKind.deposit ? -1 : 1
    }

    const pA = a.periodIndex ?? -1
    const pB = b.periodIndex ?? -1
    return pA - pB
  })

  let remaining = payment.amountSen

  for (const inv of sortedInvoices) {
    if (remaining <= ZERO_BIGINT) break

    const alreadyPaid = inv.allocations.reduce(
      (sum, alloc) => sum + alloc.amountSen,
      ZERO_BIGINT
    )
    const unpaid = inv.amountSen - alreadyPaid

    if (unpaid > ZERO_BIGINT) {
      const allocateAmount = remaining < unpaid ? remaining : unpaid

      await tx.paymentAllocation.create({
        data: {
          orgId: payment.orgId,
          paymentId: payment.id,
          invoiceId: inv.id,
          amountSen: allocateAmount,
        },
      })

      remaining -= allocateAmount
    }
  }

  if (remaining !== payment.unappliedSen) {
    await tx.payment.update({
      where: { id: payment.id },
      data: { unappliedSen: remaining },
    })
  }
}
