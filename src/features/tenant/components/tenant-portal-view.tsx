import { TenantHeader } from './tenant-header'
import { TenantLeaseCard } from './tenant-lease-card'
import { TenantProfileCard } from './tenant-profile-card'
import { TenantInvoicesTable } from './tenant-invoices-table'
import { TenantPaymentsTable } from './tenant-payments-table'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { logoutAction } from '@/app/auth/actions'
import { Home } from 'lucide-react'

interface TenantPortalViewProps {
  tenant: {
    id: string
    fullName: string
    email: string
    phone: string
    organization: {
      name: string
    }
  }
  activeLease: {
    id: string
    monthlyRentSen: number
    startDate: Date | string
    endDate: Date | string
    unit: {
      name: string
    }
  } | null
  invoices: Array<{
    id: string
    kind: string
    periodIndex: number | null
    periodStart: string | null
    periodEnd: string | null
    dueDate: string
    amountSen: number
    paidSen: number
    status: string
  }>
  payments: Array<{
    id: string
    amountSen: number
    method: string
    status: string
    receivedAt: string
  }>
  amountDueNowSen: number
}

export function TenantPortalView({
  tenant,
  activeLease,
  invoices,
  payments,
  amountDueNowSen,
}: TenantPortalViewProps) {
  if (!activeLease) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-6">
            <Home className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-slate-900">No Active Lease</h2>
            <p className="text-sm text-slate-500 mt-1 mb-6">
              There are currently no active leases registered for your account.
            </p>
            <form action={logoutAction}>
              <Button type="submit">Sign Out</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <TenantHeader
        tenantName={tenant.fullName}
        organizationName={tenant.organization.name}
      />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <TenantLeaseCard
          tenantName={tenant.fullName}
          unitName={activeLease.unit.name}
          startDate={activeLease.startDate}
          endDate={activeLease.endDate}
          leaseId={activeLease.id}
          amountDueSen={amountDueNowSen}
        />

        <TenantProfileCard
          tenantId={tenant.id}
          fullName={tenant.fullName}
          email={tenant.email}
          phone={tenant.phone}
        />

        <TenantInvoicesTable
          invoices={invoices}
          monthlyRentSen={activeLease.monthlyRentSen}
        />

        <TenantPaymentsTable payments={payments} />
      </main>
    </div>
  )
}
