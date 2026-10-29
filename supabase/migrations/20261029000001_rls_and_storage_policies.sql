-- ============================================================================
-- Migration: Row Level Security (RLS) & Storage Access Control
-- Strict enforcement of the Data API permission matrix and private storage
-- ============================================================================

-- ─── 1. Security Definer Helpers ────────────────────────────────────────────
-- Helper functions allow clean, efficient, and recursion-safe policy evaluation.
-- They execute with owner privileges and a fixed search_path.

CREATE OR REPLACE FUNCTION public.get_user_org_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id FROM memberships WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS member_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM memberships WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_tenant_org_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id FROM tenants WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM tenants WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_org_manager(target_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM memberships
    WHERE user_id = auth.uid()
      AND org_id = target_org_id
      AND role = 'manager'
  );
$$;

CREATE OR REPLACE FUNCTION public.extract_org_id_from_path(path text)
RETURNS UUID
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  first_part text;
BEGIN
  first_part := split_part(path, '/', 1);
  IF first_part ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN first_part::uuid;
  ELSE
    RETURN NULL;
  END IF;
END;
$$;

-- Grant execute on helpers to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_org_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tenant_org_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tenant_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_manager(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.extract_org_id_from_path(text) TO authenticated;

-- ─── 2. SQL Privilege Lockdown ──────────────────────────────────────────────
-- "Every other insert, update or delete through the Data API must fail for everyone."
-- "Any table that anonymous users can read or write through the Data API -> Instant Fail."

-- Revoke all table permissions from anon and public
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, public;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, public;
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon, public;

-- Revoke all table permissions from authenticated by default
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;

-- Explicitly GRANT only the minimum required permissions to authenticated
GRANT SELECT ON organizations TO authenticated;
GRANT SELECT ON memberships TO authenticated;
GRANT SELECT ON units TO authenticated;
GRANT SELECT ON leases TO authenticated;
GRANT SELECT ON invoices TO authenticated;
GRANT SELECT ON payments TO authenticated;
GRANT SELECT ON payment_allocations TO authenticated;
GRANT SELECT ON gateway_bills TO authenticated;
GRANT SELECT ON audit_log TO authenticated;

-- On tenants, grant SELECT and strictly UPDATE only on the phone column
GRANT SELECT ON tenants TO authenticated;
GRANT UPDATE (phone) ON tenants TO authenticated;

-- ─── 3. Row Level Security Policies ─────────────────────────────────────────

-- 1. Organizations
-- Tenant, Staff, Manager: read own organization
DROP POLICY IF EXISTS "organizations_select" ON organizations;
CREATE POLICY "organizations_select" ON organizations
FOR SELECT TO authenticated
USING (
  id = public.get_user_org_id() OR id = public.get_tenant_org_id()
);

-- 2. Memberships
-- Tenant: none. Staff, Manager: read own organization
DROP POLICY IF EXISTS "memberships_select" ON memberships;
CREATE POLICY "memberships_select" ON memberships
FOR SELECT TO authenticated
USING (
  org_id = public.get_user_org_id()
);

-- 3. Units
-- Staff, Manager: read own organization
-- Tenant: read the units of own leases
DROP POLICY IF EXISTS "units_select" ON units;
CREATE POLICY "units_select" ON units
FOR SELECT TO authenticated
USING (
  org_id = public.get_user_org_id()
  OR
  EXISTS (
    SELECT 1 FROM leases
    WHERE leases.unit_id = units.id
      AND leases.tenant_id = public.get_tenant_id()
  )
);

-- 4. Tenants
-- Staff, Manager: read own organization
-- Tenant: read own row, update only phone
DROP POLICY IF EXISTS "tenants_select" ON tenants;
CREATE POLICY "tenants_select" ON tenants
FOR SELECT TO authenticated
USING (
  org_id = public.get_user_org_id()
  OR
  user_id = auth.uid()
);

DROP POLICY IF EXISTS "tenants_update_phone" ON tenants;
CREATE POLICY "tenants_update_phone" ON tenants
FOR UPDATE TO authenticated
USING (
  user_id = auth.uid()
)
WITH CHECK (
  user_id = auth.uid()
);

-- 5. Leases
-- Staff, Manager: read own organization
-- Tenant: read rows of own leases
DROP POLICY IF EXISTS "leases_select" ON leases;
CREATE POLICY "leases_select" ON leases
FOR SELECT TO authenticated
USING (
  org_id = public.get_user_org_id()
  OR
  tenant_id = public.get_tenant_id()
);

-- 6. Invoices
-- Staff, Manager: read own organization
-- Tenant: read rows of own leases
DROP POLICY IF EXISTS "invoices_select" ON invoices;
CREATE POLICY "invoices_select" ON invoices
FOR SELECT TO authenticated
USING (
  org_id = public.get_user_org_id()
  OR
  EXISTS (
    SELECT 1 FROM leases
    WHERE leases.id = invoices.lease_id
      AND leases.tenant_id = public.get_tenant_id()
  )
);

-- 7. Payments
-- Staff, Manager: read own organization
-- Tenant: read rows of own leases
DROP POLICY IF EXISTS "payments_select" ON payments;
CREATE POLICY "payments_select" ON payments
FOR SELECT TO authenticated
USING (
  org_id = public.get_user_org_id()
  OR
  EXISTS (
    SELECT 1 FROM leases
    WHERE leases.id = payments.lease_id
      AND leases.tenant_id = public.get_tenant_id()
  )
);

-- 8. Payment Allocations
-- Staff, Manager: read own organization
-- Tenant: read rows of own leases
DROP POLICY IF EXISTS "payment_allocations_select" ON payment_allocations;
CREATE POLICY "payment_allocations_select" ON payment_allocations
FOR SELECT TO authenticated
USING (
  org_id = public.get_user_org_id()
  OR
  EXISTS (
    SELECT 1 FROM payments
    JOIN leases ON leases.id = payments.lease_id
    WHERE payments.id = payment_allocations.payment_id
      AND leases.tenant_id = public.get_tenant_id()
  )
);

-- 9. Gateway Bills
-- Staff, Manager: read own organization
-- Tenant: read rows of own leases
DROP POLICY IF EXISTS "gateway_bills_select" ON gateway_bills;
CREATE POLICY "gateway_bills_select" ON gateway_bills
FOR SELECT TO authenticated
USING (
  org_id = public.get_user_org_id()
  OR
  EXISTS (
    SELECT 1 FROM leases
    WHERE leases.id = gateway_bills.lease_id
      AND leases.tenant_id = public.get_tenant_id()
  )
);

-- 10. Audit Log
-- Tenant: none. Staff: none. Manager: read own organization
-- Append-only trigger guarantees immutability
DROP POLICY IF EXISTS "audit_log_select" ON audit_log;
CREATE POLICY "audit_log_select" ON audit_log
FOR SELECT TO authenticated
USING (
  public.is_org_manager(org_id)
);

-- ─── 4. Storage Policies: payment-slips Bucket ──────────────────────────────
-- Bucket: 'payment-slips'
-- Paths: '<org_id>/...'
-- Access: Only staff and managers of that organization can upload and read.
-- Tenants, other orgs, and anon have NO access.

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Allow Staff and Managers of an org to upload slips under their org folder
DROP POLICY IF EXISTS "slips_insert_policy" ON storage.objects;
CREATE POLICY "slips_insert_policy" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'payment-slips'
  AND public.get_user_role() IN ('manager', 'staff')
  AND public.extract_org_id_from_path(name) = public.get_user_org_id()
);

-- Allow Staff and Managers of an org to read slips from their org folder
DROP POLICY IF EXISTS "slips_select_policy" ON storage.objects;
CREATE POLICY "slips_select_policy" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'payment-slips'
  AND public.get_user_role() IN ('manager', 'staff')
  AND public.extract_org_id_from_path(name) = public.get_user_org_id()
);

