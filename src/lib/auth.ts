import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

export type UserRole = 'manager' | 'staff' | 'tenant'

export interface AuthContext {
  userId: string
  email: string
  role: UserRole
  orgId: string
  tenantId?: string // Defined only when role === 'tenant'
}

/**
 * Standard JSON error response helper returning `{ "error": "message" }`.
 */
export function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status })
}

/**
 * Resolves the authenticated user and their validated role/organization from the database.
 * 
 * SECURITY RULES ENFORCED:
 * 1. Authenticates strictly with `supabase.auth.getUser()`, never `getSession()`.
 * 2. Accepts both cookies and `Authorization: Bearer <access_token>` headers.
 * 3. Roles and organization IDs are fetched strictly from `memberships` and `tenants` tables.
 *    `user_metadata` is NEVER used because the user could edit it.
 */
export async function getAuthContext(req?: Request): Promise<AuthContext | null> {
  const supabase = await createClient(req)

  // Check for Bearer token in request headers
  let bearerToken: string | undefined
  if (req) {
    const authHeader = req.headers.get('authorization')
    if (authHeader?.toLowerCase().startsWith('bearer ')) {
      bearerToken = authHeader.slice(7).trim()
    }
  } else {
    try {
      const h = await headers()
      const authHeader = h.get('authorization')
      if (authHeader?.toLowerCase().startsWith('bearer ')) {
        bearerToken = authHeader.slice(7).trim()
      }
    } catch (err) {
      console.error('Error getting auth context:', err)
    }
  }

  const { data: { user }, error } = bearerToken
    ? await supabase.auth.getUser(bearerToken)
    : await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  // 1. Check memberships (staff or manager)
  const membership = await prisma.membership.findUnique({
    where: { userId: user.id },
  })

  if (membership) {
    return {
      userId: user.id,
      email: user.email ?? '',
      role: membership.role as 'manager' | 'staff',
      orgId: membership.orgId,
    }
  }

  // 2. Check tenants (tenant role)
  const tenant = await prisma.tenant.findUnique({
    where: { userId: user.id },
  })

  if (tenant) {
    return {
      userId: user.id,
      email: user.email ?? '',
      role: 'tenant',
      orgId: tenant.orgId,
      tenantId: tenant.id,
    }
  }

  // User exists in auth.users but has no membership or tenant profile in the system
  return null
}

/**
 * Ensures the caller is authenticated and has one of the allowed roles.
 * Returns the AuthContext if valid, or a NextResponse error to return immediately.
 */
export async function requireAuth(
  req: Request | undefined,
  allowedRoles?: UserRole[]
): Promise<{ auth: AuthContext; errorResponse?: never } | { auth?: never; errorResponse: NextResponse }> {
  const auth = await getAuthContext(req)

  if (!auth) {
    return { errorResponse: jsonError('Unauthorized: missing or invalid credentials', 401) }
  }

  if (allowedRoles && !allowedRoles.includes(auth.role)) {
    return { errorResponse: jsonError('Forbidden: your role does not have permission for this action', 403) }
  }

  return { auth }
}

