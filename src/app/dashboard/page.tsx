import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getAuthContext } from '@/lib/auth'
import { ROLES, BUSINESS_CONFIG } from '@/lib/constants'
import { ROUTES } from '@/lib/routes'
import { getCollectionsReportService } from '@/lib/services/report.service'
import { invoiceStatus } from '@/lib/billing'
import { Navbar } from '@/components/navbar'
import { formatRinggit } from '@/lib/format-date'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { AlertCircle, TrendingUp, FileText, ArrowRight } from 'lucide-react'

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

  // 2. Compute 6-Month Collections Range in Malaysia Time (UTC+8)
  const mytNow = new Date(Date.now() + BUSINESS_CONFIG.UTC_OFFSET_MS)
  const endYear = mytNow.getUTCFullYear()
  const endMonth = mytNow.getUTCMonth() + 1

  let startYear = endYear
  let startMonth = endMonth - 5
  if (startMonth <= 0) {
    startMonth += 12
    startYear -= 1
  }

  const from = `${startYear}-${String(startMonth).padStart(2, '0')}`
  const to = `${endYear}-${String(endMonth).padStart(2, '0')}`

  const collections = await getCollectionsReportService(auth, from, to)
  const maxCollected = Math.max(...collections.map((c) => c.collectedSen), 1)
  const total6MonthCollected = collections.reduce((sum, c) => sum + c.collectedSen, 0)

  return (
    <div className="min-h-screen bg-slate-50/50">
      <Navbar
        userEmail={auth.email}
        role={auth.role}
        orgName={organization?.name ?? 'Organization'}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Collections Overview</h1>
          <p className="text-sm text-slate-500 mt-1">Real-time rent collection tracking and overdue invoice metrics.</p>
        </div>

        {/* Top Metric Cards using Shadcn Card */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <Card>
            <div className="flex items-start justify-between">
              <div>
                <CardDescription className="uppercase tracking-wider font-semibold text-xs">
                  Overdue Invoices
                </CardDescription>
                <div className="text-3xl font-extrabold text-slate-900 mt-2">{overdueCount}</div>
                <p className="text-xs text-slate-500 mt-1">Requiring immediate tenant follow-up</p>
              </div>
              <div
                className={`p-3 rounded-xl ${
                  overdueCount > 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
                }`}
              >
                <AlertCircle className="w-6 h-6" />
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-start justify-between">
              <div>
                <CardDescription className="uppercase tracking-wider font-semibold text-xs">
                  6-Month Total Collected
                </CardDescription>
                <div className="text-3xl font-extrabold text-slate-900 mt-2">{formatRinggit(total6MonthCollected)}</div>
                <p className="text-xs text-slate-500 mt-1">Approved payments across all leases</p>
              </div>
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                <TrendingUp className="w-6 h-6" />
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-start justify-between">
              <div>
                <CardDescription className="uppercase tracking-wider font-semibold text-xs">
                  Active Leases
                </CardDescription>
                <div className="text-3xl font-extrabold text-slate-900 mt-2">
                  <Link href={ROUTES.LEASES} className="hover:text-indigo-600 transition flex items-center gap-1.5">
                    Manage
                    <ArrowRight className="w-5 h-5 inline text-slate-400" />
                  </Link>
                </div>
                <p className="text-xs text-slate-500 mt-1">Record payments and review schedules</p>
              </div>
              <div className="p-3 bg-slate-100 text-slate-700 rounded-xl">
                <FileText className="w-6 h-6" />
              </div>
            </div>
          </Card>
        </div>

        {/* 6-Month Collections Chart using Shadcn Card */}
        <Card className="gap-4">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle>Collections by Month (MYT)</CardTitle>
              <CardDescription>
                Approved rent & deposit receipts ({from} to {to})
              </CardDescription>
            </div>
            <Badge variant="secondary" className="font-mono text-xs">
              Total: {formatRinggit(total6MonthCollected)}
            </Badge>
          </CardHeader>

          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-4 pt-4">
              {collections.map((item) => {
                const heightPercent = Math.round((item.collectedSen / maxCollected) * 100)
                return (
                  <div
                    key={item.month}
                    className="flex flex-col items-center bg-slate-50/80 p-4 rounded-xl border border-slate-100"
                  >
                    <div className="w-full h-32 flex items-end justify-center mb-3">
                      <div
                        style={{ height: `${Math.max(heightPercent, 4)}%` }}
                        className={`w-10 rounded-t-lg transition-all duration-500 ${
                          item.collectedSen > 0 ? 'bg-slate-900 shadow-xs' : 'bg-slate-200'
                        }`}
                      />
                    </div>
                    <span className="text-xs font-mono font-bold text-slate-900">
                      {formatRinggit(item.collectedSen)}
                    </span>
                    <span className="text-[11px] font-medium text-slate-500 mt-1">{item.month}</span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
