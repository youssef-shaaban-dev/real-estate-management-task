import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getAuthContext } from '@/lib/auth'
import { ROLES, BUSINESS_CONFIG } from '@/lib/constants'
import { ROUTES } from '@/lib/routes'
import { getLeaseDetailsService } from '@/lib/services/lease.service'
import { formatMalaysiaDate, formatMalaysiaDateTime, formatRinggit } from '@/lib/format-date'
import { TenantPayButton } from '@/components/tenant-pay-button'
import { TenantPhoneForm } from '@/components/tenant-phone-form'
import { logoutAction } from '@/app/auth/actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Building2, LogOut, Home } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function TenantPortalPage() {
  const auth = await getAuthContext()
  if (!auth) {
    redirect(ROUTES.LOGIN)
  }

  if (auth.role !== ROLES.TENANT || !auth.tenantId) {
    redirect(ROUTES.DASHBOARD)
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: auth.tenantId },
    include: {
      organization: true,
      leases: {
        include: { unit: true },
        orderBy: { startDate: 'desc' },
      },
    },
  })

  if (!tenant || tenant.leases.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-6">
            <Home className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-slate-900">No Active Lease</h2>
            <p className="text-sm text-slate-500 mt-1 mb-6">There are currently no active leases registered for your account.</p>
            <form action={logoutAction}>
              <Button type="submit">
                Sign Out
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  const activeLease = tenant.leases[0]
  const details = await getLeaseDetailsService(auth, activeLease.id)
  const { invoices, payments } = details

  const mytNow = new Date(Date.now() + BUSINESS_CONFIG.UTC_OFFSET_MS)
  const todayMyt = mytNow.toISOString().slice(0, 10)

  const amountDueNowSen = invoices.reduce((sum, inv) => {
    if (inv.dueDate <= todayMyt) {
      const unpaid = inv.amountSen - inv.paidSen
      return unpaid > 0 ? sum + unpaid : sum
    }
    return sum
  }, 0)

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-slate-900 text-white rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-slate-900 text-sm block">Tenant Portal</span>
              <span className="text-xs text-slate-500 block">{tenant.organization.name}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-xs font-medium text-slate-700 hidden sm:inline">{tenant.fullName}</span>
            <form action={logoutAction}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <Card className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 p-6 sm:p-8">
          <div>
            <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider block">
              Unit {activeLease.unit.name} • Active Lease
            </span>
            <h1 className="text-2xl font-extrabold text-slate-900 mt-1">Hello, {tenant.fullName}</h1>
            <p className="text-xs text-slate-500 mt-1">
              Term: {formatMalaysiaDate(activeLease.startDate)} → {formatMalaysiaDate(activeLease.endDate)}
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col sm:items-end gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase">Amount Due Now (MYT)</span>
            <span className="text-2xl font-black text-slate-900">{formatRinggit(amountDueNowSen)}</span>
            <TenantPayButton leaseId={activeLease.id} amountDueSen={amountDueNowSen} />
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm uppercase tracking-wider">Contact Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-sm">
              <div>
                <span className="text-xs text-slate-400 block mb-1">Full Name</span>
                <span className="font-medium text-slate-800">{tenant.fullName}</span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block mb-1">Email</span>
                <span className="font-medium text-slate-800">{tenant.email}</span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block mb-1">Contact Phone (Click to Edit)</span>
                <TenantPhoneForm tenantId={tenant.id} initialPhone={tenant.phone} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Your Invoices</CardTitle>
            <span className="text-xs text-slate-500 font-mono">Monthly Rent: {formatRinggit(activeLease.monthlyRentSen)}</span>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50/70 text-xs font-semibold text-slate-500 uppercase">
                  <tr>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3">Period</th>
                    <th className="px-4 py-3">Due Date (MYT)</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Paid</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {invoices.map((inv) => {
                    const variantMap: Record<string, 'success' | 'info' | 'secondary' | 'danger'> = {
                      paid: 'success',
                      partially_paid: 'info',
                      unpaid: 'secondary',
                      overdue: 'danger',
                    }
                    return (
                      <tr key={inv.id} className="hover:bg-slate-50/70 transition">
                        <td className="px-4 py-3.5 capitalize font-medium text-slate-900">
                          {inv.kind === 'deposit' ? 'Security Deposit' : `Rent (Period #${inv.periodIndex})`}
                        </td>
                        <td className="px-4 py-3.5 text-xs text-slate-600">
                          {inv.periodStart ? `${formatMalaysiaDate(inv.periodStart)} → ${formatMalaysiaDate(inv.periodEnd)}` : '-'}
                        </td>
                        <td className="px-4 py-3.5 text-xs font-medium text-slate-700">{formatMalaysiaDate(inv.dueDate)}</td>
                        <td className="px-4 py-3.5 font-medium text-slate-900">{formatRinggit(inv.amountSen)}</td>
                        <td className="px-4 py-3.5 font-medium text-slate-900">{formatRinggit(inv.paidSen)}</td>
                        <td className="px-4 py-3.5">
                          <Badge variant={variantMap[inv.status] || 'secondary'}>
                            {inv.status.replace('_', ' ')}
                          </Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment History</CardTitle>
          </CardHeader>
          <CardContent>
            {payments.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No payment transactions recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                  <thead className="bg-slate-50/70 text-xs font-semibold text-slate-500 uppercase">
                    <tr>
                      <th className="px-4 py-3">Date (MYT)</th>
                      <th className="px-4 py-3">Method</th>
                      <th className="px-4 py-3">Amount</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {payments.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/70 transition">
                        <td className="px-4 py-3 text-xs text-slate-700 whitespace-nowrap">
                          {formatMalaysiaDateTime(p.receivedAt)}
                        </td>
                        <td className="px-4 py-3 text-xs capitalize font-medium text-slate-800">
                          {p.method.replace('_', ' ')}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-900">{formatRinggit(p.amountSen)}</td>
                        <td className="px-4 py-3">
                          <Badge variant={p.status === 'approved' ? 'success' : p.status === 'voided' ? 'danger' : 'secondary'}>
                            {p.status.replace('_', ' ')}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
