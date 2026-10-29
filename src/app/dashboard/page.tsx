import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getAuthContext } from '@/lib/auth'
import { ROLES, BUSINESS_CONFIG } from '@/lib/constants'
import { ROUTES } from '@/lib/routes'
import { getCollectionsReportService } from '@/lib/services/report.service'
import { invoiceStatus } from '@/lib/billing'
import { DashboardView } from '@/features/dashboard/components/dashboard-view'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const auth = await getAuthContext()
  if (!auth) {
    redirect(ROUTES.LOGIN)
  }

  if (auth.role === ROLES.TENANT) {
    redirect(ROUTES.TENANT)
  }

  const organization = await prisma.organization.findUnique({
    where: { id: auth.orgId },
  })

  // 1. Calculate Overdue Invoices on Server
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

  // 2. Compute 6-Month Collections Range in Malaysia Time (UTC+8) strictly on Server
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

  return (
    <DashboardView
      userEmail={auth.email}
      role={auth.role}
      orgName={organization?.name ?? 'Organization'}
      overdueCount={overdueCount}
      total6MonthCollectedSen={total6MonthCollectedSen}
      collections={collections}
      fromMonth={fromMonth}
      toMonth={toMonth}
    />
  )
}
