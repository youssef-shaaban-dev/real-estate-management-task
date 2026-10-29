/**
 * lib/billing.ts
 *
 * PURE billing functions for the rent collection system.
 * Zero I/O, zero external framework imports, timezone-independent.
 */

export type InvoiceKind = 'deposit' | 'rent'

export interface ScheduledInvoice {
  kind: InvoiceKind
  periodIndex: number | null  // 0, 1, 2... for rent; null for the deposit
  periodStart: string | null  // 'YYYY-MM-DD'; null for the deposit
  periodEnd: string | null    // 'YYYY-MM-DD', inclusive; null for the deposit
  dueDate: string             // 'YYYY-MM-DD'
  amountSen: number           // integer
}

export type InvoiceStatus = 'paid' | 'partially_paid' | 'unpaid' | 'overdue'

// ─── Pure Calendar Date Helpers ──────────────────────────────────────────────

/**
 * Validates whether year is a leap year in the Gregorian calendar.
 */
function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0)
}

/**
 * Returns the number of calendar days in a given year and month (1-12).
 */
function getDaysInMonth(year: number, month: number): number {
  switch (month) {
    case 1:  // Jan
    case 3:  // Mar
    case 5:  // May
    case 7:  // Jul
    case 8:  // Aug
    case 10: // Oct
    case 12: // Dec
      return 31
    case 4:  // Apr
    case 6:  // Jun
    case 9:  // Sep
    case 11: // Nov
      return 30
    case 2:  // Feb
      return isLeapYear(year) ? 29 : 28
    default:
      throw new Error(`Invalid month: ${month}`)
  }
}

/**
 * Validates strictly that str is a real calendar date formatted as YYYY-MM-DD.
 * Returns [year, month, day] if valid, or throws an Error.
 */
function parseAndValidateCalendarDate(str: string): [number, number, number] {
  if (typeof str !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    throw new Error(`Invalid calendar date format (expected YYYY-MM-DD): "${str}"`)
  }

  const [yStr, mStr, dStr] = str.split('-')
  const y = parseInt(yStr, 10)
  const m = parseInt(mStr, 10)
  const d = parseInt(dStr, 10)

  if (m < 1 || m > 12) {
    throw new Error(`Invalid month in calendar date: "${str}"`)
  }

  const maxDays = getDaysInMonth(y, m)
  if (d < 1 || d > maxDays) {
    throw new Error(`Invalid day in calendar date: "${str}" (month ${m} has ${maxDays} days)`)
  }

  return [y, m, d]
}

/**
 * Computes anchor k: startDate plus k calendar months counted from startDate.
 * If that month has fewer days than startDate's day, uses the month's last day.
 */
function getAnchorDate(startY: number, startM: number, startD: number, k: number): string {
  const totalMonths = (startM - 1) + k
  const targetYear = startY + Math.floor(totalMonths / 12)
  const targetMonth = (totalMonths % 12) + 1
  const maxDays = getDaysInMonth(targetYear, targetMonth)
  const anchorDay = Math.min(startD, maxDays)

  return `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(anchorDay).padStart(2, '0')}`
}

/**
 * Returns the calendar day before dateStr ('YYYY-MM-DD').
 */
function getDayBefore(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  if (d > 1) {
    return `${y}-${String(m).padStart(2, '0')}-${String(d - 1).padStart(2, '0')}`
  }

  const prevMonth = m === 1 ? 12 : m - 1
  const prevYear = m === 1 ? y - 1 : y
  const prevDays = getDaysInMonth(prevYear, prevMonth)

  return `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(prevDays).padStart(2, '0')}`
}

/**
 * Computes the inclusive number of days between two calendar dates (startStr and endStr).
 * Uses pure UTC millisecond math to remain completely timezone-agnostic.
 */
function countInclusiveDays(startStr: string, endStr: string): number {
  const [y1, m1, d1] = startStr.split('-').map(Number)
  const [y2, m2, d2] = endStr.split('-').map(Number)

  const utc1 = Date.UTC(y1, m1 - 1, d1)
  const utc2 = Date.UTC(y2, m2 - 1, d2)

  const diffMs = utc2 - utc1
  const diffDays = Math.round(diffMs / 86400000)

  return diffDays + 1
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Generates the full invoice schedule for a lease.
 */
export function generateSchedule(lease: {
  startDate: string
  endDate: string
  monthlyRentSen: number
  depositSen: number
}): ScheduledInvoice[] {
  // 1. Validation
  const [startY, startM, startD] = parseAndValidateCalendarDate(lease.startDate)
  parseAndValidateCalendarDate(lease.endDate)

  if (lease.endDate < lease.startDate) {
    throw new Error(`endDate (${lease.endDate}) cannot be before startDate (${lease.startDate})`)
  }

  if (
    typeof lease.monthlyRentSen !== 'number' ||
    !Number.isInteger(lease.monthlyRentSen) ||
    lease.monthlyRentSen <= 0
  ) {
    throw new Error(`monthlyRentSen must be a positive integer, received: ${lease.monthlyRentSen}`)
  }

  if (
    typeof lease.depositSen !== 'number' ||
    !Number.isInteger(lease.depositSen) ||
    lease.depositSen < 0
  ) {
    throw new Error(`depositSen must be a non-negative integer, received: ${lease.depositSen}`)
  }

  const schedule: ScheduledInvoice[] = []

  // 2. Deposit invoice (if depositSen > 0)
  if (lease.depositSen > 0) {
    schedule.push({
      kind: 'deposit',
      periodIndex: null,
      periodStart: null,
      periodEnd: null,
      dueDate: lease.startDate,
      amountSen: lease.depositSen,
    })
  }

  // 3. Rent periods
  let periodIndex = 0
  while (true) {
    const anchor = getAnchorDate(startY, startM, startD, periodIndex)

    // Stop if this anchor falls after the lease end date
    if (anchor > lease.endDate) {
      break
    }

    const nextAnchor = getAnchorDate(startY, startM, startD, periodIndex + 1)
    const fullPeriodEnd = getDayBefore(nextAnchor)

    const periodStart = anchor
    const dueDate = anchor

    if (lease.endDate < fullPeriodEnd) {
      // Last period cut at endDate: prorated
      const periodEnd = lease.endDate
      const daysUsed = countInclusiveDays(periodStart, periodEnd)
      const fullDays = countInclusiveDays(periodStart, fullPeriodEnd)

      // monthlyRentSen x days used / days in full period, rounded half up to nearest sen
      const proratedAmount = Math.round((lease.monthlyRentSen * daysUsed) / fullDays)

      schedule.push({
        kind: 'rent',
        periodIndex,
        periodStart,
        periodEnd,
        dueDate,
        amountSen: proratedAmount,
      })
    } else {
      // Full period
      schedule.push({
        kind: 'rent',
        periodIndex,
        periodStart,
        periodEnd: fullPeriodEnd,
        dueDate,
        amountSen: lease.monthlyRentSen,
      })
    }

    periodIndex++
  }

  return schedule
}

/**
 * Computes invoice status based on amount, paid amount, due date, and current time.
 * Rules applied in strict order:
 * 1. paid if paidSen >= amountSen
 * 2. overdue if today's Malaysia date is after dueDate
 * 3. partially_paid if paidSen > 0
 * 4. otherwise unpaid
 */
export function invoiceStatus(
  invoice: { dueDate: string; amountSen: number; paidSen: number },
  now: Date,
): InvoiceStatus {
  // 1. Paid check
  if (invoice.paidSen >= invoice.amountSen) {
    return 'paid'
  }

  // Malaysia time is fixed UTC+8 (+28,800,000 ms) without daylight saving
  const mytEpoch = now.getTime() + 8 * 60 * 60 * 1000
  const todayMyt = new Date(mytEpoch).toISOString().slice(0, 10)

  // 2. Overdue check: today's Malaysia date is after dueDate
  if (todayMyt > invoice.dueDate) {
    return 'overdue'
  }

  // 3. Partially paid check
  if (invoice.paidSen > 0) {
    return 'partially_paid'
  }

  // 4. Unpaid
  return 'unpaid'
}

/**
 * Converts formatted ringgit string input into sen (integer).
 * Accepts digits with optional comma thousands separators (groups of exactly 3 digits)
 * and an optional decimal part of 1 or 2 digits.
 * Throws Error for any invalid format or non-numeric tokens.
 */
export function parseRinggitToSen(input: string): number {
  if (typeof input !== 'string') {
    throw new Error('Invalid input: must be a string')
  }

  const trimmed = input.trim()
  if (!trimmed) {
    throw new Error('Invalid input: empty string')
  }

  // Matches either:
  // - digits with commas: 1,500 or 1,000,000
  // - plain digits without commas: 1500 or 7
  // Followed by optional .d or .dd
  const match = trimmed.match(/^(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?$/)
  if (!match) {
    throw new Error(`Invalid ringgit format: "${input}"`)
  }

  const intPart = match[1].replace(/,/g, '')
  const decPart = match[2] || ''

  const ringgit = parseInt(intPart, 10)
  const senFromDec = decPart ? parseInt(decPart.padEnd(2, '0'), 10) : 0

  return ringgit * 100 + senFromDec
}

