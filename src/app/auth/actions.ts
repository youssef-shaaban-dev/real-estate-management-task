'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAuthContext } from '@/lib/auth'
import { ROLES } from '@/lib/constants'
import { ROUTES } from '@/lib/routes'

export async function loginAction(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'Email and password are required' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: error.message }
  }

  const auth = await getAuthContext()
  if (!auth) {
    return { error: 'Account has no assigned role in this system' }
  }

  if (auth.role === ROLES.TENANT) {
    redirect(ROUTES.TENANT)
  } else {
    redirect(ROUTES.DASHBOARD)
  }
}

export async function logoutAction() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect(ROUTES.LOGIN)
}
