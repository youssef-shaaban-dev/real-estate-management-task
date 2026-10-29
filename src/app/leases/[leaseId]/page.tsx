import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getAuthContext } from '@/lib/auth'
import { ROLES, MemberRole } from '@/lib/constants'
import { ROUTES } from '@/lib/routes'
import { Navbar } from '@/components/navbar'
import { getLeaseDetailsService } from '@/lib/services/lease.service'
import { formatMalaysiaDate, formatMalaysiaDateTime, formatRinggit } from '@/lib/format-date'
import { RecordPaymentModal } from '@/components/payment-modal'
import { ManagerActions } from '@/components/manager-actions'
import { SlipLink } from '@/components/slip-link'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { ArrowLeft, User, Building, Calendar, DollarSign } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface LeasePageProps {
  params: Promise<{ leaseId: string }>
}

export default async function LeaseDetailsPage({ params }: LeasePageProps) {
  const auth = await getAuthContext()
  if (!auth) {
    redirect(ROUTES.LOGIN)
  }

  if (auth.role === ROLES.TENANT) {
    redirect(ROUTES.TENANT)
  }

  const { leaseId } = await params

  let details
  try {
    details = await getLeaseDetailsService(auth, leaseId)
  } catch {
    notFound()
  }

  const organization = await prisma.organization.findUnique({
    where: { id: auth.orgId },
  })

  const fullLease = await prisma.lease.findUnique({
    where: { id: leaseId },
    include: { unit: true, tenant: true },
  })

  if (!fullLease) {
    notFound()
  }

  const { lease, invoices, payments, defaultReceivedAtMyt } = details
  const isManager = auth.role === MemberRole.manager

  const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.amountSen, 0)
  const totalPaid = invoices.reduce((sum, inv) => sum + inv.paidSen, 0)
  const balanceRemaining = totalInvoiced - totalPaid

  return (
    <div className="min-h-screen bg-slate-50/50 pb-16">
      <Navbar
        userEmail={auth.email}
        role={auth.role}
        orgName={organization?.name ?? 'Organization'}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div>
          <Link
            href={ROUTES.LEASES}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition mb-3"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Leases
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Unit {fullLease.unit.name} • {fullLease.tenant.fullName}
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Lease ID: <span className="font-mono text-slate-700">{lease.id}</span>
              </p>
            </div>
            <div>
              <RecordPaymentModal
                leaseId={lease.id}
                orgId={auth.orgId}
                userRole={auth.role}
                defaultReceivedAt={defaultReceivedAtMyt}
              />
            </div>
          </div>
        </div>

        {/* Lease Summary Cards using Shadcn Card */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="p-4 gap-1">
            <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
              <Building className="w-3.5 h-3.5" /> Unit
            </div>
            <span className="text-base font-bold text-slate-900 font-mono mt-1">{fullLease.unit.name}</span>
          </Card>

          <Card className="p-4 gap-1">
            <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
              <Calendar className="w-3.5 h-3.5" /> Term (MYT)
            </div>
            <span className="text-xs font-medium text-slate-800 block mt-1">
              {formatMalaysiaDate(lease.startDate)} → {formatMalaysiaDate(lease.endDate)}
            </span>
          </Card>

          <Card className="p-4 gap-1">
            <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
              <DollarSign className="w-3.5 h-3.5" /> Monthly Rent
            </div>
            <span className="text-base font-bold text-slate-900 mt-1">{formatRinggit(lease.monthlyRentSen)}</span>
          </Card>

          <Card className="p-4 gap-1">
            <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
              <User className="w-3.5 h-3.5" /> Outstanding Balance
            </div>
            <span className="text-base font-bold text-slate-900 mt-1">{formatRinggit(balanceRemaining)}</span>
          </Card>
        </div>

        {/* Invoices Table using Shadcn Card */}
        <Card className="p-6 gap-4">
          <CardHeader className="flex flex-row items-center justify-between pb-0 p-0">
            <div>
              <CardTitle>Scheduled Invoices</CardTitle>
              <CardDescription className="mt-0.5">
                Deposit and monthly rent invoices ordered by due date.
              </CardDescription>
            </div>
            <Badge variant="secondary" className="font-mono text-xs">
              Total Invoiced: {formatRinggit(totalInvoiced)}
            </Badge>
          </CardHeader>

          <div className="overflow-x-auto pt-2">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50/70 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Period (MYT)</th>
                  <th className="px-4 py-3">Due Date</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Paid</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {invoices.map((inv) => {
                  const badgeVariantMap: Record<string, 'success' | 'info' | 'outline' | 'danger'> = {
                    paid: 'success',
                    partially_paid: 'info',
                    unpaid: 'outline',
                    overdue: 'danger',
                  }
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-4 py-3.5 capitalize font-medium text-slate-900">
                        {inv.kind}
                        {inv.periodIndex !== null && ` #${inv.periodIndex}`}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-600">
                        {inv.periodStart ? `${formatMalaysiaDate(inv.periodStart)} → ${formatMalaysiaDate(inv.periodEnd)}` : 'N/A'}
                      </td>
                      <td className="px-4 py-3.5 text-xs font-medium text-slate-700">
                        {formatMalaysiaDate(inv.dueDate)}
                      </td>
                      <td className="px-4 py-3.5 font-medium text-slate-900">
                        {formatRinggit(inv.amountSen)}
                      </td>
                      <td className="px-4 py-3.5 font-medium text-slate-900">
                        {formatRinggit(inv.paidSen)}
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge variant={badgeVariantMap[inv.status] || 'secondary'}>
                          {inv.status.replace('_', ' ')}
                        </Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Payments Table using Shadcn Card */}
        <Card className="p-6 gap-4">
          <CardHeader className="flex flex-row items-center justify-between pb-0 p-0">
            <div>
              <CardTitle>Recorded Payments</CardTitle>
              <CardDescription className="mt-0.5">
                Audit trail of cash, bank transfer, and online payments.
              </CardDescription>
            </div>
            <Badge variant="secondary" className="font-mono text-xs">
              Total Approved: {formatRinggit(totalPaid)}
            </Badge>
          </CardHeader>

          {payments.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-sm">No payments recorded on this lease yet.</div>
          ) : (
            <div className="overflow-x-auto pt-2">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50/70 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Received (MYT)</th>
                    <th className="px-4 py-3">Method</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Unapplied</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Slip</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {payments.map((p) => {
                    const badgeVariantMap: Record<string, 'success' | 'warning' | 'danger' | 'secondary'> = {
                      approved: 'success',
                      pending_verification: 'warning',
                      rejected: 'danger',
                      voided: 'secondary',
                    }
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/70 transition">
                        <td className="px-4 py-3.5 text-xs text-slate-700 whitespace-nowrap">
                          {formatMalaysiaDateTime(p.receivedAt)}
                        </td>
                        <td className="px-4 py-3.5 text-xs capitalize font-medium text-slate-800">
                          {p.method.replace('_', ' ')}
                        </td>
                        <td className="px-4 py-3.5 font-medium text-slate-900">
                          {formatRinggit(p.amountSen)}
                        </td>
                        <td className="px-4 py-3.5 text-xs text-slate-500">
                          {p.unappliedSen > 0 ? formatRinggit(p.unappliedSen) : '-'}
                        </td>
                        <td className="px-4 py-3.5">
                          <Badge variant={badgeVariantMap[p.status] || 'secondary'}>
                            {p.status.replace('_', ' ')}
                          </Badge>
                        </td>
                        <td className="px-4 py-3.5">
                          {p.method === 'bank_transfer' ? (
                            <SlipLink slipPath={p.slipPath} />
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <ManagerActions
                            paymentId={p.id}
                            status={p.status}
                            isManager={isManager}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </main>
    </div>
  )
}
