import assert from 'node:assert/strict'

function isValidYearMonth(str: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(str)) return false
  const [y, m] = str.split('-').map(Number)
  return m >= 1 && m <= 12 && y >= 1900 && y <= 2100
}

function generateMonthSequence(from: string, to: string): string[] {
  const [startY, startM] = from.split('-').map(Number)
  const [endY, endM] = to.split('-').map(Number)

  const months: string[] = []
  let curY = startY
  let curM = startM

  while (curY < endY || (curY === endY && curM <= endM)) {
    const formatted = `${curY}-${String(curM).padStart(2, '0')}`
    months.push(formatted)

    curM++
    if (curM > 12) {
      curM = 1
      curY++
    }
  }

  return months
}

console.log('Testing collections report month sequence & range validation...')

// 1. Valid range 2026-01 to 2026-03
const seq1 = generateMonthSequence('2026-01', '2026-03')
assert.deepEqual(seq1, ['2026-01', '2026-02', '2026-03'])
console.log('✔ Sequence 2026-01 to 2026-03 verified.')

// 2. Multi-year span 2025-11 to 2026-02
const seq2 = generateMonthSequence('2025-11', '2026-02')
assert.deepEqual(seq2, ['2025-11', '2025-12', '2026-01', '2026-02'])
console.log('✔ Multi-year sequence verified.')

// 3. Single month range
const seq3 = generateMonthSequence('2026-05', '2026-05')
assert.deepEqual(seq3, ['2026-05'])
console.log('✔ Single month sequence verified.')

// 4. Validation
assert.equal(isValidYearMonth('2026-01'), true)
assert.equal(isValidYearMonth('2026-12'), true)
assert.equal(isValidYearMonth('2026-13'), false)
assert.equal(isValidYearMonth('2026-00'), false)
assert.equal(isValidYearMonth('2026'), false)
assert.equal(isValidYearMonth('2026-1'), false)
assert.equal(isValidYearMonth('invalid'), false)
console.log('✔ Month format validation verified.')

console.log('ALL REPORT UNIT TESTS PASSED! 🎉')

