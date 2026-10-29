import { redirect } from 'next/navigation'
import { getAuthContext } from '@/lib/auth'
import { ROLES } from '@/lib/constants'
import { ROUTES } from '@/lib/routes'
import { getDashboardDataService } from '@/lib/services/dashboard.service'
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

  const data = await getDashboardDataService(auth)

  return (
    <DashboardView
      userEmail={auth.email}
      role={auth.role}
      orgName={data.organizationName}
      overdueCount={data.overdueCount}
      total6MonthCollectedSen={data.total6MonthCollectedSen}
      collections={data.collections}
      fromMonth={data.fromMonth}
      toMonth={data.toMonth}
    />
  )
}
