import { createClient } from '@supabase/supabase-js'

/**
 * Returns a Supabase client authenticated with the service role key.
 * 
 * CRITICAL SECURITY CONSTRAINTS:
 * 1. This client bypasses Row Level Security (RLS).
 * 2. It must ONLY be used on the server in secure backend operations
 *    (such as gateway webhook processing or admin scripts).
 * 3. NEVER expose this client, the service role key, or invoke this in client components.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase admin environment variables (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)')
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

