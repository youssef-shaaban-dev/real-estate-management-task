-- ============================================================================
-- Initial Schema: Rent Collection System
-- All money stored as integer sen (BIGINT). No floating-point types.
-- Calendar dates as DATE. Instants as TIMESTAMPTZ.
-- ============================================================================

-- Required for the lease overlap exclusion constraint (GiST on uuid + daterange)
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- ─── Enums ──────────────────────────────────────────────────────────────────

CREATE TYPE member_role    AS ENUM ('manager', 'staff');
CREATE TYPE invoice_kind   AS ENUM ('deposit', 'rent');
CREATE TYPE payment_method AS ENUM ('cash', 'bank_transfer', 'online');
CREATE TYPE payment_status AS ENUM ('pending_verification', 'approved', 'rejected', 'voided');
CREATE TYPE bill_status    AS ENUM ('pending', 'paid', 'failed');

-- ─── Organizations ──────────────────────────────────────────────────────────

CREATE TABLE organizations (
  id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL
);

-- ─── Memberships (staff / manager → exactly one org) ────────────────────────

CREATE TABLE memberships (
  id      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id  UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role    member_role NOT NULL
);

CREATE INDEX idx_memberships_org_id ON memberships(org_id);

-- ─── Units ──────────────────────────────────────────────────────────────────

CREATE TABLE units (
  id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name   TEXT NOT NULL,
  UNIQUE (org_id, name)
);

CREATE INDEX idx_units_org_id ON units(org_id);

-- ─── Tenants ────────────────────────────────────────────────────────────────

CREATE TABLE tenants (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id    UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email     TEXT NOT NULL,
  phone     TEXT
);

CREATE INDEX idx_tenants_org_id ON tenants(org_id);

-- ─── Leases ─────────────────────────────────────────────────────────────────
-- Money: monthly_rent_sen & deposit_sen are integer sen (BIGINT).
-- The EXCLUDE constraint prevents overlapping leases on the same unit.
-- daterange(..., '[]') means both start_date and end_date are inclusive.

CREATE TABLE leases (
  id               UUID   PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID   NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  unit_id          UUID   NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  tenant_id        UUID   NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  start_date       DATE   NOT NULL,
  end_date         DATE   NOT NULL,
  monthly_rent_sen BIGINT NOT NULL CHECK (monthly_rent_sen > 0),
  deposit_sen      BIGINT NOT NULL DEFAULT 0 CHECK (deposit_sen >= 0),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  CHECK (end_date >= start_date),

  EXCLUDE USING gist (
    unit_id WITH =,
    daterange(start_date, end_date, '[]') WITH &&
  )
);

CREATE INDEX idx_leases_org_id    ON leases(org_id);
CREATE INDEX idx_leases_unit_id   ON leases(unit_id);
CREATE INDEX idx_leases_tenant_id ON leases(tenant_id);

-- ─── Invoices ───────────────────────────────────────────────────────────────

CREATE TABLE invoices (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lease_id     UUID         NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  kind         invoice_kind NOT NULL,
  period_index INTEGER,
  period_start DATE,
  period_end   DATE,
  due_date     DATE         NOT NULL,
  amount_sen   BIGINT       NOT NULL CHECK (amount_sen >= 0)
);

CREATE INDEX idx_invoices_lease_id ON invoices(lease_id);
CREATE INDEX idx_invoices_org_id   ON invoices(org_id);

-- ─── Gateway Bills ──────────────────────────────────────────────────────────
-- id is TEXT: generated in app code (unguessable, e.g. bill_<crypto-random>).
-- Must be created before payments table (FK dependency).

CREATE TABLE gateway_bills (
  id         TEXT        PRIMARY KEY,
  org_id     UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lease_id   UUID        NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  amount_sen BIGINT      NOT NULL CHECK (amount_sen > 0),
  status     bill_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_gateway_bills_lease_id ON gateway_bills(lease_id);

-- ─── Payments ───────────────────────────────────────────────────────────────
-- idempotency_key: UUID provided by the client for manual payments.
-- gateway_bill_id: one payment per gateway bill (UNIQUE).

CREATE TABLE payments (
  id              UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID           NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lease_id        UUID           NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  amount_sen      BIGINT         NOT NULL CHECK (amount_sen > 0),
  unapplied_sen   BIGINT         NOT NULL DEFAULT 0 CHECK (unapplied_sen >= 0),
  method          payment_method NOT NULL,
  status          payment_status NOT NULL,
  received_at     TIMESTAMPTZ    NOT NULL,
  slip_path       TEXT,
  gateway_bill_id TEXT           UNIQUE REFERENCES gateway_bills(id),
  idempotency_key TEXT           UNIQUE,
  created_at      TIMESTAMPTZ    NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_lease_id    ON payments(lease_id);
CREATE INDEX idx_payments_org_id      ON payments(org_id);
CREATE INDEX idx_payments_received_at ON payments(received_at);
CREATE INDEX idx_payments_status      ON payments(status);

-- ─── Payment Allocations ────────────────────────────────────────────────────

CREATE TABLE payment_allocations (
  id         UUID   PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID   NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  payment_id UUID   NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  invoice_id UUID   NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount_sen BIGINT NOT NULL CHECK (amount_sen > 0)
);

CREATE INDEX idx_allocations_payment_id ON payment_allocations(payment_id);
CREATE INDEX idx_allocations_invoice_id ON payment_allocations(invoice_id);

-- ─── Audit Log ──────────────────────────────────────────────────────────────
-- Append-only: the trigger below prevents UPDATE and DELETE for ALL roles,
-- including the database owner and the service role.

CREATE TABLE audit_log (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_id   UUID        NOT NULL,
  action     TEXT        NOT NULL,
  entity_id  TEXT,
  details    JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_org_id     ON audit_log(org_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);

-- Trigger: make audit_log truly append-only
CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only: UPDATE and DELETE are not allowed';
END;
$$;

CREATE TRIGGER trg_audit_log_no_modify
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_modification();

-- ─── Row Level Security (enabled, no policies yet — default deny) ───────────
-- With RLS enabled and zero policies, the Data API (anon/authenticated) cannot
-- read or write any row. The postgres role (used by Prisma) bypasses RLS as
-- the table owner. Policies are added in a subsequent migration.

ALTER TABLE organizations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships          ENABLE ROW LEVEL SECURITY;
ALTER TABLE units                ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants              ENABLE ROW LEVEL SECURITY;
ALTER TABLE leases               ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices             ENABLE ROW LEVEL SECURITY;
ALTER TABLE gateway_bills        ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments             ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_allocations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log            ENABLE ROW LEVEL SECURITY;

-- ─── Storage Bucket ─────────────────────────────────────────────────────────
-- Private bucket for bank transfer slips. 5 MB limit. JPEG/PNG/PDF only.
-- Storage policies are added in a subsequent migration alongside RLS policies.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payment-slips',
  'payment-slips',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'application/pdf']
);

