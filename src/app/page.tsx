import { redirect } from 'next/navigation'
import { getAuthContext } from '@/lib/auth'
import { ROLES } from '@/lib/constants'
import { ROUTES } from '@/lib/routes'

export default async function HomePage() {
  const auth = await getAuthContext()

  if (!auth) {
    redirect(ROUTES.LOGIN)
  }

  if (auth.role === ROLES.TENANT) {
    redirect(ROUTES.TENANT)
  }

  redirect(ROUTES.DASHBOARD)
}
