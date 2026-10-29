import { prisma } from '@/lib/prisma'
import { allocate } from '@/lib/allocation'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  MemberRole,
  PaymentMethod,
  PaymentStatus,
  AUDIT_ACTIONS,
  BUSINESS_CONFIG,
  STORAGE,
} from '@/lib/constants'
import { AuthContext } from '@/lib/auth'

const ZERO_BIGINT = BigInt(0)

export class PaymentError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message)
    this.name = 'PaymentError'
  }
}

export interface RecordPaymentInput {
  amountSen: number
  method: PaymentMethod
  receivedAt: string
  slipPath?: string
  idempotencyKey?: string
}

async function validateSlipFile(orgId: string, slipPath: string): Promise<void> {
  const expectedPrefix = `${orgId}/`
  if (!slipPath.startsWith(expectedPrefix)) {
    throw new PaymentError(400, 'Invalid slip path: must reside in organization folder')
  }

  const adminClient = createAdminClient()
  const relativePath = slipPath.slice(expectedPrefix.length)

  const { data, error } = await adminClient.storage
    .from(STORAGE.PAYMENT_SLIPS_BUCKET)
    .list(orgId, { search: relativePath })

  if (error || !data || data.length === 0) {
    throw new PaymentError(400, 'Uploaded slip file not found in storage')
  }
}

async function cleanupSlipFile(slipPath?: string): Promise<void> {
  if (!slipPath) return
  try {
    const adminClient = createAdminClient()
    await adminClient.storage
      .from(STORAGE.PAYMENT_SLIPS_BUCKET)
      .remove([slipPath])
  } catch {
    // Best-effort cleanup
  }
}

export async function recordPaymentService(
  auth: AuthContext,
  leaseId: string,
  input: RecordPaymentInput
) {
  const { amountSen, method, receivedAt, slipPath, idempotencyKey } = input

  if (auth.role !== MemberRole.manager && auth.role !== MemberRole.staff) {
    throw new PaymentError(403, 'Forbidden: only staff and managers can record payments')
  }

  if (typeof amountSen !== 'number' || !Number.isInteger(amountSen) || amountSen <= 0) {
    throw new PaymentError(400, 'amountSen must be a positive integer')
  }

  if (method !== PaymentMethod.cash && method !== PaymentMethod.bank_transfer) {
    throw new PaymentError(400, 'Invalid payment method: must be cash or bank_transfer')
  }

  if (method === PaymentMethod.bank_transfer) {
    if (!slipPath) {
      throw new PaymentError(400, 'Bank transfer payments require an uploaded slip')
    }
    await validateSlipFile(auth.orgId, slipPath)
  }

  const parsedReceivedAt = new Date(receivedAt)
  if (isNaN(parsedReceivedAt.getTime())) {
    await cleanupSlipFile(slipPath)
    throw new PaymentError(400, 'Invalid receivedAt timestamp format')
  }

  if (idempotencyKey) {
    const existing = await prisma.payment.findUnique({
      where: { idempotencyKey },
    })
    if (existing) {
      return { id: existing.id, status: existing.status }
    }
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const lease = await tx.lease.findFirst({
        where: { id: leaseId, orgId: auth.orgId },
      })

      if (!lease) {
        throw new PaymentError(404, 'Lease not found')
      }

      await tx.$executeRaw`SELECT id FROM leases WHERE id = ${leaseId}::uuid FOR UPDATE`

      const invoices = await tx.invoice.findMany({
        where: { leaseId },
        include: { allocations: true },
      })

      const totalInvoiced = invoices.reduce(
        (sum, inv) => sum + inv.amountSen,
        ZERO_BIGINT
      )
      const totalAllocated = invoices.reduce(
        (sum, inv) =>
          sum + inv.allocations.reduce((aSum, a) => aSum + a.amountSen, ZERO_BIGINT),
        ZERO_BIGINT
      )
      const remainingBalance = totalInvoiced - totalAllocated

      const pendingPayments = await tx.payment.findMany({
        where: {
          leaseId,
          status: PaymentStatus.pending_verification,
        },
      })
      const totalPending = pendingPayments.reduce(
        (sum, p) => sum + p.amountSen,
        ZERO_BIGINT
      )

      const cap = remainingBalance - totalPending
      const paymentAmountBigInt = BigInt(amountSen)

      if (paymentAmountBigInt > cap) {
        throw new PaymentError(422, 'Payment exceeds the remaining balance cap')
      }

      const initialStatus =
        auth.role === MemberRole.manager
          ? PaymentStatus.approved
          : PaymentStatus.pending_verification

      const payment = await tx.payment.create({
        data: {
          orgId: auth.orgId,
          leaseId,
          amountSen: paymentAmountBigInt,
          method,
          status: initialStatus,
          receivedAt: parsedReceivedAt,
          slipPath: method === PaymentMethod.bank_transfer ? slipPath : null,
          idempotencyKey,
        },
      })

      if (initialStatus === PaymentStatus.approved) {
        await allocate(tx, payment.id)
      }

      return { id: payment.id, status: payment.status }
    })
  } catch (err: unknown) {
    if (err instanceof PaymentError && err.statusCode === 422) {
      await cleanupSlipFile(slipPath)
    }
    throw err
  }
}

export async function approvePaymentService(auth: AuthContext, paymentId: string) {
  if (auth.role !== MemberRole.manager) {
    throw new PaymentError(403, 'Forbidden: only managers can approve payments')
  }

  return await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findFirst({
      where: { id: paymentId, orgId: auth.orgId },
    })

    if (!payment) {
      throw new PaymentError(404, 'Payment not found')
    }

    if (payment.status !== PaymentStatus.pending_verification) {
      throw new PaymentError(409, 'Payment is not pending verification')
    }

    await tx.$executeRaw`SELECT id FROM leases WHERE id = ${payment.leaseId}::uuid FOR UPDATE`

    const invoices = await tx.invoice.findMany({
      where: { leaseId: payment.leaseId },
      include: { allocations: true },
    })

    const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.amountSen, ZERO_BIGINT)
    const totalAllocated = invoices.reduce(
      (sum, inv) =>
        sum + inv.allocations.reduce((aSum, a) => aSum + a.amountSen, ZERO_BIGINT),
      ZERO_BIGINT
    )
    const remainingBalance = totalInvoiced - totalAllocated

    if (payment.amountSen > remainingBalance) {
      throw new PaymentError(422, 'Payment exceeds remaining balance')
    }

    await tx.payment.update({
      where: { id: paymentId },
      data: { status: PaymentStatus.approved },
    })

    await allocate(tx, payment.id)

    await tx.auditLog.create({
      data: {
        orgId: auth.orgId,
        actorId: auth.userId,
        action: AUDIT_ACTIONS.APPROVE_PAYMENT,
        entityId: payment.id,
        details: { amountSen: Number(payment.amountSen) },
      },
    })

    return { status: PaymentStatus.approved }
  })
}

export async function rejectPaymentService(
  auth: AuthContext,
  paymentId: string,
  reason: string
) {
  if (auth.role !== MemberRole.manager) {
    throw new PaymentError(403, 'Forbidden: only managers can reject payments')
  }

  if (!reason || reason.trim().length < BUSINESS_CONFIG.MIN_REASON_LENGTH) {
    throw new PaymentError(400, 'Reason must be at least 5 characters')
  }

  return await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findFirst({
      where: { id: paymentId, orgId: auth.orgId },
    })

    if (!payment) {
      throw new PaymentError(404, 'Payment not found')
    }

    if (payment.status !== PaymentStatus.pending_verification) {
      throw new PaymentError(409, 'Payment is not pending verification')
    }

    await tx.payment.update({
      where: { id: paymentId },
      data: { status: PaymentStatus.rejected },
    })

    await tx.auditLog.create({
      data: {
        orgId: auth.orgId,
        actorId: auth.userId,
        action: AUDIT_ACTIONS.REJECT_PAYMENT,
        entityId: payment.id,
        details: { reason: reason.trim() },
      },
    })

    return { status: PaymentStatus.rejected }
  })
}

export async function voidPaymentService(
  auth: AuthContext,
  paymentId: string,
  reason: string
) {
  if (auth.role !== MemberRole.manager) {
    throw new PaymentError(403, 'Forbidden: only managers can void payments')
  }

  if (!reason || reason.trim().length < BUSINESS_CONFIG.MIN_REASON_LENGTH) {
    throw new PaymentError(400, 'Reason must be at least 5 characters')
  }

  return await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findFirst({
      where: { id: paymentId, orgId: auth.orgId },
    })

    if (!payment) {
      throw new PaymentError(404, 'Payment not found')
    }

    if (payment.status !== PaymentStatus.approved) {
      throw new PaymentError(409, 'Payment is not approved')
    }

    await tx.$executeRaw`SELECT id FROM leases WHERE id = ${payment.leaseId}::uuid FOR UPDATE`

    await tx.paymentAllocation.deleteMany({
      where: { paymentId },
    })

    await tx.payment.update({
      where: { id: paymentId },
      data: {
        status: PaymentStatus.voided,
        unappliedSen: ZERO_BIGINT,
      },
    })

    await tx.auditLog.create({
      data: {
        orgId: auth.orgId,
        actorId: auth.userId,
        action: AUDIT_ACTIONS.VOID_PAYMENT,
        entityId: payment.id,
        details: {
          reason: reason.trim(),
          amountSen: Number(payment.amountSen),
        },
      },
    })

    return { status: PaymentStatus.voided }
  })
}
