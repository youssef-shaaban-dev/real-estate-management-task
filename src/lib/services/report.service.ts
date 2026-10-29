import { prisma } from '@/lib/prisma'
import { MemberRole, ROLES } from '@/lib/constants'
import { AuthContext } from '@/lib/auth'

export class ReportError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message)
    this.name = 'ReportError'
  }
}

export interface CollectionMonthReport {
  month: string
  collectedSen: number
}

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

/**
 * Returns total collected sen grouped by calendar month in Malaysia time.
 * Covers every month in the range sequentially, zero-filling empty months.
 */
export async function getCollectionsReportService(
  auth: AuthContext,
  from: string | null,
  to: string | null
): Promise<CollectionMonthReport[]> {
  if (auth.role !== MemberRole.manager && auth.role !== MemberRole.staff) {
    throw new ReportError(403, 'Forbidden: only staff and managers can view reports')
  }

  if (!from || !to || !isValidYearMonth(from) || !isValidYearMonth(to) || from > to) {
    throw new ReportError(400, 'Invalid range: "from" and "to" must be valid YYYY-MM dates with from <= to')
  }

  const allMonths = generateMonthSequence(from, to)

  // Query payments converted to Asia/Kuala_Lumpur timezone
  const rows = await prisma.$queryRaw<{ month: string; total_sen: bigint }[]>`
    SELECT
      to_char(received_at AT TIME ZONE 'Asia/Kuala_Lumpur', 'YYYY-MM') AS month,
      SUM(amount_sen) AS total_sen
    FROM payments
    WHERE org_id = ${auth.orgId}::uuid
      AND status = 'approved'
      AND (received_at AT TIME ZONE 'Asia/Kuala_Lumpur') >= (${from} || '-01 00:00:00')::timestamp
      AND (received_at AT TIME ZONE 'Asia/Kuala_Lumpur') < ((${to} || '-01 00:00:00')::timestamp + interval '1 month')
    GROUP BY 1
    ORDER BY 1 ASC
  `

  const totalsByMonth = new Map<string, number>()
  for (const r of rows) {
    totalsByMonth.set(r.month, Number(r.total_sen))
  }

  return allMonths.map((month) => ({
    month,
    collectedSen: totalsByMonth.get(month) ?? 0,
  }))
}

