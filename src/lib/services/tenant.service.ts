import { prisma } from '@/lib/prisma'
import type { AuthContext } from '@/lib/auth'
import { ROLES, BUSINESS_CONFIG } from '@/lib/constants'
import { getLeaseDetailsService } from './lease.service'

export interface FormattedTenant {
  id: string
  fullName: string
  email: string
  phone: string
  organization: {
    name: string
  }
}

export interface FormattedActiveLease {
  id: string
  monthlyRentSen: number
  startDate: string
  endDate: string
  unit: {
    name: string
  }
}

export async function getTenantPortalDataService(auth: AuthContext) {
  if (auth.role !== ROLES.TENANT || !auth.tenantId) {
    return null
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
    return {
      tenant: tenant ? {
        id: tenant.id,
        fullName: tenant.fullName,
        email: tenant.email,
        phone: tenant.phone ?? '',
        organization: {
          name: tenant.organization.name,
        },
      } : null,
      activeLease: null,
      invoices: [],
      payments: [],
      amountDueNowSen: 0,
      todayMyt: '',
    }
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

  const formattedTenant: FormattedTenant = {
    id: tenant.id,
    fullName: tenant.fullName,
    email: tenant.email,
    phone: tenant.phone ?? '',
    organization: {
      name: tenant.organization.name,
    },
  }

  const formattedActiveLease: FormattedActiveLease = {
    id: activeLease.id,
    monthlyRentSen: Number(activeLease.monthlyRentSen),
    startDate: activeLease.startDate.toISOString().slice(0, 10),
    endDate: activeLease.endDate.toISOString().slice(0, 10),
    unit: {
      name: activeLease.unit.name,
    },
  }

  return {
    tenant: formattedTenant,
    activeLease: formattedActiveLease,
    invoices,
    payments,
    amountDueNowSen,
    todayMyt,
  }
}
