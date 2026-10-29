import assert from 'node:assert/strict'
import { InvoiceKind } from '@/lib/constants'

const ZERO_BIGINT = BigInt(0)

interface MockInvoice {
  id: string
  kind: InvoiceKind
  periodIndex: number | null
  dueDate: string
  amountSen: bigint
  paidSen: bigint
}

function simulateAllocation(
  invoices: MockInvoice[],
  paymentAmountSen: bigint
): { allocations: { invoiceId: string; amountSen: bigint }[]; unappliedSen: bigint } {
  const sorted = [...invoices].sort((a, b) => {
    if (a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate)
    if (a.kind !== b.kind) {
      return a.kind === InvoiceKind.deposit ? -1 : 1
    }
    const pA = a.periodIndex ?? -1
    const pB = b.periodIndex ?? -1
    return pA - pB
  })

  let remaining = paymentAmountSen
  const allocations: { invoiceId: string; amountSen: bigint }[] = []

  for (const inv of sorted) {
    if (remaining <= ZERO_BIGINT) break

    const unpaid = inv.amountSen - inv.paidSen
    if (unpaid > ZERO_BIGINT) {
      const toAllocate = remaining < unpaid ? remaining : unpaid
      allocations.push({ invoiceId: inv.id, amountSen: toAllocate })
      remaining -= toAllocate
    }
  }

  return { allocations, unappliedSen: remaining }
}

console.log('Testing allocation algorithm...')

// Test Case 1: Deposit and rent on same due date -> Deposit gets paid first!
const invoicesCase1: MockInvoice[] = [
  { id: 'rent-0', kind: InvoiceKind.rent, periodIndex: 0, dueDate: '2026-01-31', amountSen: BigInt(150000), paidSen: ZERO_BIGINT },
  { id: 'dep-1', kind: InvoiceKind.deposit, periodIndex: null, dueDate: '2026-01-31', amountSen: BigInt(300000), paidSen: ZERO_BIGINT },
]

const result1 = simulateAllocation(invoicesCase1, BigInt(300000))
assert.equal(result1.allocations.length, 1)
assert.equal(result1.allocations[0].invoiceId, 'dep-1')
assert.equal(result1.allocations[0].amountSen, BigInt(300000))
assert.equal(result1.unappliedSen, ZERO_BIGINT)
console.log('✔ Case 1: Deposit before rent prioritized correctly.')

// Test Case 2: Partial allocation across multiple rent periods
const invoicesCase2: MockInvoice[] = [
  { id: 'rent-0', kind: InvoiceKind.rent, periodIndex: 0, dueDate: '2026-01-31', amountSen: BigInt(150000), paidSen: BigInt(150000) },
  { id: 'rent-1', kind: InvoiceKind.rent, periodIndex: 1, dueDate: '2026-02-28', amountSen: BigInt(150000), paidSen: ZERO_BIGINT },
  { id: 'rent-2', kind: InvoiceKind.rent, periodIndex: 2, dueDate: '2026-03-31', amountSen: BigInt(150000), paidSen: ZERO_BIGINT },
]

const result2 = simulateAllocation(invoicesCase2, BigInt(200000))
assert.equal(result2.allocations.length, 2)
assert.equal(result2.allocations[0].invoiceId, 'rent-1')
assert.equal(result2.allocations[0].amountSen, BigInt(150000))
assert.equal(result2.allocations[1].invoiceId, 'rent-2')
assert.equal(result2.allocations[1].amountSen, BigInt(50000))
assert.equal(result2.unappliedSen, ZERO_BIGINT)
console.log('✔ Case 2: Multi-invoice waterfall allocation verified.')

// Test Case 3: Overpayment (Online payment) produces unapplied_sen
const invoicesCase3: MockInvoice[] = [
  { id: 'rent-0', kind: InvoiceKind.rent, periodIndex: 0, dueDate: '2026-01-31', amountSen: BigInt(100000), paidSen: ZERO_BIGINT },
]
const result3 = simulateAllocation(invoicesCase3, BigInt(120000))
assert.equal(result3.allocations.length, 1)
assert.equal(result3.allocations[0].amountSen, BigInt(100000))
assert.equal(result3.unappliedSen, BigInt(20000))
console.log('✔ Case 3: Unapplied sen captured correctly on overpayment.')

console.log('ALL ALLOCATION TESTS PASSED! 🎉')
