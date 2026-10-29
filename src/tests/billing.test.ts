import { generateSchedule, invoiceStatus, parseRinggitToSen } from '@/lib/billing'
import assert from 'node:assert/strict'

console.log('Testing lib/billing.ts...')

// ─── 1. parseRinggitToSen Tests ──────────────────────────────────────────────
console.log('Testing parseRinggitToSen...')
assert.equal(parseRinggitToSen('1,500.50'), 150050)
assert.equal(parseRinggitToSen('1.15'), 115)
assert.equal(parseRinggitToSen('7'), 700)
assert.equal(parseRinggitToSen('   1,500.50   '), 150050)
assert.equal(parseRinggitToSen('0'), 0)
assert.equal(parseRinggitToSen('0.5'), 50)
assert.equal(parseRinggitToSen('0.05'), 5)
assert.equal(parseRinggitToSen('0.00'), 0)
assert.equal(parseRinggitToSen('1000'), 100000)
assert.equal(parseRinggitToSen('1,000,000.00'), 100000000)

// Invalid inputs
const invalidInputs = [
  '',
  '   ',
  '-5',
  '1.234',
  '1e3',
  'RM 10',
  '1,23',
  '1,2345',
  ',123',
  '123,',
  '.5',
  '5.',
  'abc',
  '1,00,000',
]

for (const inv of invalidInputs) {
  assert.throws(
    () => parseRinggitToSen(inv),
    { name: 'Error' },
    `Should have thrown for "${inv}"`,
  )
}
console.log('✔ parseRinggitToSen passed all tests.')

// ─── 2. Worked Example: Aisyah Rahman ────────────────────────────────────────
console.log('Testing generateSchedule with Aisyah Rahman lease...')
const aisyahSchedule = generateSchedule({
  startDate: '2026-01-31',
  endDate: '2026-07-15',
  monthlyRentSen: 150000,
  depositSen: 300000,
})

assert.equal(aisyahSchedule.length, 7) // deposit + 6 rent periods (0 to 5)

// Deposit
assert.deepEqual(aisyahSchedule[0], {
  kind: 'deposit',
  periodIndex: null,
  periodStart: null,
  periodEnd: null,
  dueDate: '2026-01-31',
  amountSen: 300000,
})

// Period 0
assert.deepEqual(aisyahSchedule[1], {
  kind: 'rent',
  periodIndex: 0,
  periodStart: '2026-01-31',
  periodEnd: '2026-02-27',
  dueDate: '2026-01-31',
  amountSen: 150000,
})

// Period 1
assert.deepEqual(aisyahSchedule[2], {
  kind: 'rent',
  periodIndex: 1,
  periodStart: '2026-02-28',
  periodEnd: '2026-03-30',
  dueDate: '2026-02-28',
  amountSen: 150000,
})

// Period 2
assert.deepEqual(aisyahSchedule[3], {
  kind: 'rent',
  periodIndex: 2,
  periodStart: '2026-03-31',
  periodEnd: '2026-04-29',
  dueDate: '2026-03-31',
  amountSen: 150000,
})

// Period 3
assert.deepEqual(aisyahSchedule[4], {
  kind: 'rent',
  periodIndex: 3,
  periodStart: '2026-04-30',
  periodEnd: '2026-05-30',
  dueDate: '2026-04-30',
  amountSen: 150000,
})

// Period 4
assert.deepEqual(aisyahSchedule[5], {
  kind: 'rent',
  periodIndex: 4,
  periodStart: '2026-05-31',
  periodEnd: '2026-06-29',
  dueDate: '2026-05-31',
  amountSen: 150000,
})

// Period 5: Prorated
// 16 of 31 days from 2026-06-30 to 2026-07-30: 150000 x 16 / 31 = 77419.35 -> 77419 sen
assert.deepEqual(aisyahSchedule[6], {
  kind: 'rent',
  periodIndex: 5,
  periodStart: '2026-06-30',
  periodEnd: '2026-07-15',
  dueDate: '2026-06-30',
  amountSen: 77419,
})
console.log('✔ Worked example matched to the exact sen.')

// ─── 3. No Deposit Lease (Ben Lim) ───────────────────────────────────────────
console.log('Testing generateSchedule with Ben Lim lease (no deposit)...')
const benSchedule = generateSchedule({
  startDate: '2026-01-01',
  endDate: '2026-04-15',
  monthlyRentSen: 100029,
  depositSen: 0,
})

assert.equal(benSchedule.length, 4)
assert.equal(benSchedule[0].kind, 'rent')
assert.equal(benSchedule[0].periodIndex, 0)
assert.equal(benSchedule[0].periodStart, '2026-01-01')
assert.equal(benSchedule[0].periodEnd, '2026-01-31')
assert.equal(benSchedule[0].amountSen, 100029)

assert.equal(benSchedule[3].periodStart, '2026-04-01')
assert.equal(benSchedule[3].periodEnd, '2026-04-15')
assert.equal(benSchedule[3].amountSen, 50015)
console.log('✔ Ben Lim schedule verified.')

// ─── 4. Leap Year Anchors & Period Validation ────────────────────────────────
console.log('Testing leap year anchors...')
const leapSchedule = generateSchedule({
  startDate: '2024-01-31',
  endDate: '2024-03-15',
  monthlyRentSen: 120000,
  depositSen: 0,
})
assert.equal(leapSchedule[0].periodStart, '2024-01-31')
assert.equal(leapSchedule[0].periodEnd, '2024-02-28')
assert.equal(leapSchedule[1].periodStart, '2024-02-29')
assert.equal(leapSchedule[1].periodEnd, '2024-03-15')
console.log('✔ Leap year handling verified.')

// ─── 5. Validation Errors ────────────────────────────────────────────────────
console.log('Testing generateSchedule validation errors...')
assert.throws(() => generateSchedule({ startDate: '2026-02-29', endDate: '2026-03-01', monthlyRentSen: 100, depositSen: 0 }), /Invalid day/)
assert.throws(() => generateSchedule({ startDate: '2026-01-01', endDate: '2025-12-31', monthlyRentSen: 100, depositSen: 0 }), /cannot be before/)
assert.throws(() => generateSchedule({ startDate: '2026-01-01', endDate: '2026-02-01', monthlyRentSen: 0, depositSen: 0 }), /monthlyRentSen must be a positive integer/)
assert.throws(() => generateSchedule({ startDate: '2026-01-01', endDate: '2026-02-01', monthlyRentSen: -50, depositSen: 0 }), /monthlyRentSen must be a positive integer/)
assert.throws(() => generateSchedule({ startDate: '2026-01-01', endDate: '2026-02-01', monthlyRentSen: 100.5, depositSen: 0 }), /monthlyRentSen must be a positive integer/)
assert.throws(() => generateSchedule({ startDate: '2026-01-01', endDate: '2026-02-01', monthlyRentSen: 100, depositSen: -10 }), /depositSen must be a non-negative integer/)
console.log('✔ Validation errors verified.')

// ─── 6. invoiceStatus Tests ──────────────────────────────────────────────────
console.log('Testing invoiceStatus with exact Malaysia boundary instants...')

const inv = { dueDate: '2026-03-01', amountSen: 100000, paidSen: 0 }

const justBeforeOverdue = new Date('2026-03-01T15:59:59.999Z')
assert.equal(invoiceStatus(inv, justBeforeOverdue), 'unpaid')

const exactOverdueInstant = new Date('2026-03-01T16:00:00.000Z')
assert.equal(invoiceStatus(inv, exactOverdueInstant), 'overdue')

const partialInv = { dueDate: '2026-03-01', amountSen: 100000, paidSen: 50000 }
assert.equal(invoiceStatus(partialInv, justBeforeOverdue), 'partially_paid')
assert.equal(invoiceStatus(partialInv, exactOverdueInstant), 'overdue')

const fullyPaidInv = { dueDate: '2026-03-01', amountSen: 100000, paidSen: 100000 }
assert.equal(invoiceStatus(fullyPaidInv, exactOverdueInstant), 'paid')

const overpaidInv = { dueDate: '2026-03-01', amountSen: 100000, paidSen: 150000 }
assert.equal(invoiceStatus(overpaidInv, exactOverdueInstant), 'paid')

console.log('✔ invoiceStatus passed all boundary tests.')
console.log('ALL LIB/BILLING.TS TESTS PASSED SUCCESSFULLY! 🎉')

