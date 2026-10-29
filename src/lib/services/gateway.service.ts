import crypto from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { allocate } from '@/lib/allocation'
import {
  BillStatus,
  PaymentMethod,
  PaymentStatus,
  ROLES,
  BUSINESS_CONFIG,
} from '@/lib/constants'
import { AuthContext } from '@/lib/auth'

export class GatewayError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message)
    this.name = 'GatewayError'
  }
}

/**
 * Creates an unguessable gateway bill for the tenant's unpaid invoices due on or before today (MYT).
 */
export async function createGatewayBillService(auth: AuthContext, leaseId: string) {
  if (auth.role !== ROLES.TENANT) {
    throw new GatewayError(403, 'Forbidden: only the lease tenant can create gateway bills')
  }

  const lease = await prisma.lease.findFirst({
    where: { id: leaseId, orgId: auth.orgId },
    include: {
      invoices: {
        include: { allocations: true },
      },
    },
  })

  if (!lease || lease.tenantId !== auth.tenantId) {
    throw new GatewayError(404, 'Lease not found')
  }

  // Today's Malaysia date
  const mytTime = new Date(Date.now() + BUSINESS_CONFIG.UTC_OFFSET_MS)
  const todayMyt = mytTime.toISOString().slice(0, 10)

  // Invoices due on or before today
  const dueInvoices = lease.invoices.filter((inv) => {
    const dueStr = inv.dueDate.toISOString().slice(0, 10)
    return dueStr <= todayMyt
  })

  const ZERO_BIGINT = BigInt(0)
  const amountDueNowBigInt = dueInvoices.reduce((total, inv) => {
    const paid = inv.allocations.reduce((sum, a) => sum + a.amountSen, ZERO_BIGINT)
    const unpaid = inv.amountSen - paid
    return unpaid > ZERO_BIGINT ? total + unpaid : total
  }, ZERO_BIGINT)

  if (amountDueNowBigInt <= ZERO_BIGINT) {
    throw new GatewayError(422, 'No invoices currently due for payment')
  }

  // Cryptographically secure, unguessable bill ID (32 hex characters)
  const billId = `bill_${crypto.randomBytes(16).toString('hex')}`

  const bill = await prisma.gatewayBill.create({
    data: {
      id: billId,
      orgId: lease.orgId,
      leaseId: lease.id,
      amountSen: amountDueNowBigInt,
      status: BillStatus.pending,
    },
  })

  return {
    billId: bill.id,
    amountSen: Number(bill.amountSen),
  }
}

/**
 * Verifies gateway webhook signature using constant-time comparison.
 */
export function verifyGatewaySignature(
  fields: Record<string, string>,
  signature: string | undefined,
  secretKey: string
): boolean {
  if (!signature) return false

  const source = Object.keys(fields)
    .filter((k) => k !== 'x_signature')
    .sort()
    .map((k) => `${k}${fields[k]}`)
    .join('|')

  const expected = crypto.createHmac('sha256', secretKey).update(source).digest('hex')

  if (signature.length !== expected.length) return false

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
}

/**
 * Handles incoming gateway webhook callbacks.
 * Idempotent, concurrency-safe with SELECT ... FOR UPDATE.
 */
export async function processGatewayWebhookService(fields: Record<string, string>) {
  const secretKey = process.env.GATEWAY_X_SIGNATURE_KEY
  if (!secretKey) {
    throw new GatewayError(500, 'Gateway signature key not configured')
  }

  // 1. Signature check
  const isValid = verifyGatewaySignature(fields, fields.x_signature, secretKey)
  if (!isValid) {
    throw new GatewayError(401, 'Invalid signature')
  }

  const billId = fields.id
  if (!billId) {
    throw new GatewayError(404, 'Unknown bill id')
  }

  const isPaid = fields.paid === 'true'
  const paidAmountStr = fields.paid_amount || '0'
  const paidAmount = parseInt(paidAmountStr, 10)

  // 2. Atomic processing with row lock
  return await prisma.$transaction(async (tx) => {
    // Pessimistic lock on the bill to serialize concurrent webhook deliveries
    const bills = await tx.$queryRaw<{ id: string; org_id: string; lease_id: string; amount_sen: bigint; status: string }[]>`
      SELECT id, org_id, lease_id, amount_sen, status FROM gateway_bills
      WHERE id = ${billId}
      FOR UPDATE
    `

    if (bills.length === 0) {
      throw new GatewayError(404, 'Unknown bill id')
    }

    const bill = bills[0]

    if (isPaid) {
      if (BigInt(paidAmount) !== bill.amount_sen) {
        throw new GatewayError(422, 'paid_amount does not match bill amount')
      }

      // If already paid: idempotent success (repeat delivery)
      if (bill.status === BillStatus.paid) {
        return { ok: true }
      }

      // Mark bill as paid
      await tx.gatewayBill.update({
        where: { id: bill.id },
        data: { status: BillStatus.paid },
      })

      // Normalize date string with offset (e.g., "2026-04-01 00:30:12 +0800")
      const rawPaidAt = fields.paid_at || ''
      const normalizedPaidAt = rawPaidAt.includes(' ') && rawPaidAt.lastIndexOf(' ') > 10
        ? rawPaidAt.replace(' ', 'T').replace(/ ([+-]\d{4})$/, '$1')
        : rawPaidAt
      const receivedAt = new Date(normalizedPaidAt)
      const validDate = isNaN(receivedAt.getTime()) ? new Date() : receivedAt

      const payment = await tx.payment.create({
        data: {
          orgId: bill.org_id,
          leaseId: bill.lease_id,
          amountSen: bill.amount_sen,
          method: PaymentMethod.online,
          status: PaymentStatus.approved,
          receivedAt: validDate,
          gatewayBillId: bill.id,
        },
      })

      await allocate(tx, payment.id)

      return { ok: true }
    } else {
      // paid === false
      // A paid bill never goes back (late or out-of-order callback)
      if (bill.status === BillStatus.paid) {
        return { ok: true }
      }

      if (bill.status === BillStatus.failed) {
        return { ok: true }
      }

      await tx.gatewayBill.update({
        where: { id: bill.id },
        data: { status: BillStatus.failed },
      })

      return { ok: true }
    }
  })
}

