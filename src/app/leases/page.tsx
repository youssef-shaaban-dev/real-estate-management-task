import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getAuthContext } from '@/lib/auth'
import { ROLES } from '@/lib/constants'
import { ROUTES } from '@/lib/routes'
import { Navbar } from '@/components/navbar'
import { formatMalaysiaDate, formatRinggit } from '@/lib/format-date'
import { Card } from '@/components/ui/card'
import Link from 'next/link'
import { Building, ArrowRight, User } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function LeasesListPage() {
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

  const leases = await prisma.lease.findMany({
    where: { orgId: auth.orgId },
    include: {
      unit: true,
      tenant: true,
      invoices: {
        include: { allocations: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="min-h-screen bg-slate-50/50">
      <Navbar
        userEmail={auth.email}
        role={auth.role}
        orgName={organization?.name ?? 'Organization'}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Leases & Tenants</h1>
          <p className="text-sm text-slate-500 mt-1">Manage active leases, record payments, and view billing schedules.</p>
        </div>

        {leases.length === 0 ? (
          <Card className="p-12 text-center text-slate-500">
            <Building className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <h3 className="text-base font-semibold text-slate-700">No leases found</h3>
            <p className="text-sm text-slate-400 mt-1">No leases are currently active in this organization.</p>
          </Card>
        ) : (
          <Card className="p-0 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50/80 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3.5">Unit</th>
                    <th className="px-6 py-3.5">Tenant</th>
                    <th className="px-6 py-3.5">Period (MYT)</th>
                    <th className="px-6 py-3.5">Monthly Rent</th>
                    <th className="px-6 py-3.5">Deposit</th>
                    <th className="px-6 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {leases.map((lease) => (
                    <tr key={lease.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-bold text-slate-900 font-mono">{lease.unit.name}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-slate-400" />
                          <div>
                            <span className="font-medium text-slate-800 block">{lease.tenant.fullName}</span>
                            <span className="text-xs text-slate-400 block">{lease.tenant.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                        {formatMalaysiaDate(lease.startDate)} → {formatMalaysiaDate(lease.endDate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-900">
                        {formatRinggit(lease.monthlyRentSen)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                        {formatRinggit(lease.depositSen)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <Link
                          href={ROUTES.LEASE_DETAILS(lease.id)}
                          className="inline-flex items-center gap-1 text-sm font-medium text-slate-900 hover:text-indigo-600 transition"
                        >
                          Details
                          <ArrowRight className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </main>
    </div>
  )
}
