import { redirect } from 'next/navigation'
import { getAuthContext } from '@/lib/auth'
import { ROLES } from '@/lib/constants'
import { ROUTES } from '@/lib/routes'
import { getTenantPortalDataService } from '@/lib/services/tenant.service'
import { TenantPortalView } from '@/features/tenant/components/tenant-portal-view'

export const dynamic = 'force-dynamic'

export default async function TenantPortalPage() {
  const auth = await getAuthContext()
  if (!auth) {
    redirect(ROUTES.LOGIN)
  }

  if (auth.role !== ROLES.TENANT || !auth.tenantId) {
    redirect(ROUTES.DASHBOARD)
  }

  const portalData = await getTenantPortalDataService(auth)
  if (!portalData || !portalData.tenant) {
    redirect(ROUTES.LOGIN)
  }

  return (
    <TenantPortalView
      tenant={portalData.tenant}
      activeLease={portalData.activeLease}
      invoices={portalData.invoices}
      payments={portalData.payments}
      amountDueNowSen={portalData.amountDueNowSen}
    />
  )
}
