import { prisma } from '@/lib/prisma'
import type { AuthContext } from '@/lib/auth'
import { BUSINESS_CONFIG } from '@/lib/constants'
import { invoiceStatus } from '@/lib/billing'
import { getCollectionsReportService } from './report.service'
import type { CollectionItem } from '@/features/dashboard/types'

export interface DashboardData {
  organizationName: string
  overdueCount: number
  total6MonthCollectedSen: number
  collections: CollectionItem[]
  fromMonth: string
  toMonth: string
}

export async function getDashboardDataService(auth: AuthContext): Promise<DashboardData> {
  const organization = await prisma.organization.findUnique({
    where: { id: auth.orgId },
  })

  // Overdue count calculation
  const now = new Date()
  const invoices = await prisma.invoice.findMany({
    where: { orgId: auth.orgId },
    include: { allocations: true },
  })

  let overdueCount = 0
  for (const inv of invoices) {
    const paidSen = inv.allocations.reduce((sum, a) => sum + Number(a.amountSen), 0)
    const dueDateStr = inv.dueDate.toISOString().slice(0, 10)
    const status = invoiceStatus(
      {
        dueDate: dueDateStr,
        amountSen: Number(inv.amountSen),
        paidSen,
      },
      now
    )
    if (status === 'overdue') {
      overdueCount++
    }
  }

  // 6-Month Range in Malaysia Time (UTC+8)
  const mytNow = new Date(Date.now() + BUSINESS_CONFIG.UTC_OFFSET_MS)
  const endYear = mytNow.getUTCFullYear()
  const endMonth = mytNow.getUTCMonth() + 1

  let startYear = endYear
  let startMonth = endMonth - 5
  if (startMonth <= 0) {
    startMonth += 12
    startYear -= 1
  }

  const fromMonth = `${startYear}-${String(startMonth).padStart(2, '0')}`
  const toMonth = `${endYear}-${String(endMonth).padStart(2, '0')}`

  const collections = await getCollectionsReportService(auth, fromMonth, toMonth)
  const total6MonthCollectedSen = collections.reduce((sum, c) => sum + c.collectedSen, 0)

  return {
    organizationName: organization?.name ?? 'Organization',
    overdueCount,
    total6MonthCollectedSen,
    collections,
    fromMonth,
    toMonth,
  }
}
