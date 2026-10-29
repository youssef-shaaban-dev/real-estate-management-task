# Rent Collection System — EzyFusion Group Assessment

An enterprise property management and rent collection platform built with Next.js 16 App Router, TypeScript, Supabase (PostgreSQL, Auth, RLS, Storage), Prisma ORM, and shadcn/ui.

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Node.js**: v20.6+ (v22 recommended)
- **Package Manager**: `pnpm` exclusively (`pnpm@12.15.0`)
- **Supabase CLI**: Local Supabase stack

### 2. Environment Configuration
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
Fill in the credentials from your local Supabase instance (`npx supabase status`).

### 3. Database Migration & Setup
Apply migrations and generate the Prisma Client:
```bash
npx supabase db reset
# or apply migrations manually:
pnpm prisma generate
```

### 4. Database Seeding
Populate organizations, auth users, units, leases, invoices, and payment histories:
```bash
pnpm run seed
```
*Direct execution:*
```bash
pnpm dlx tsx --env-file=.env.local --env-file=.env src/scripts/seed.ts
```

### 5. Running the Application
```bash
# Development mode
pnpm dev

# Production build and run
pnpm build
pnpm start
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 6. Running Unit Tests
```bash
pnpm test
```
Executes all test suites covering:
1. `src/tests/billing.test.ts` — Pure billing schedule generation & Malaysia timezone boundary tests.
2. `src/tests/auth.test.ts` — Error format and authentication context verification.
3. `src/tests/allocation.test.ts` — Waterfall payment allocation logic.
4. `src/tests/gateway.test.ts` — HMAC-SHA256 signature calculation & timing-safe verification against official vectors.
5. `src/tests/report.test.ts` — Monthly collections aggregation and validation.

---

## 🔑 Seed Test Accounts

All accounts are created with password: **`Password123!`**

| Email | Role | Organization | Description |
|---|---|---|---|
| `manager@northwind.test` | Manager | Northwind Properties | Primary test manager. Full permissions across leases, payments, approvals, reports. |
| `staff@northwind.test` | Staff | Northwind Properties | Staff member. Records payments (sets `pending_verification`), uploads slips. |
| `aisyah@northwind.test` | Tenant | Northwind Properties | Unit A-12-3. Has approved cash & bank payments, remaining rent due. |
| `ben@northwind.test` | Tenant | Northwind Properties | Unit B-05-1. Lease with zero deposit. |
| `probe@northwind.test` | Tenant | Northwind Properties | Unit C-01-7. Lease spanning leap year. |
| `manager@beta.test` | Manager | Beta Realty | Competing organization manager for cross-tenant isolation testing. |
| `chen@beta.test` | Tenant | Beta Realty | Unit KL-1 (Beta Realty). |

---

## 🏗️ Architecture & Technical Highlights

1. **Precision Money Handling:**
   - Zero floating-point calculations for money. Every financial value is stored and manipulated as an integer in cents/sen (`BigInt` in Prisma/Postgres, `number` integer sen in TypeScript).
2. **Timezone Invariance (Asia/Kuala_Lumpur):**
   - Server runs in UTC; all statutory reports, invoice statuses, and due dates evaluate strictly in `Asia/Kuala_Lumpur` (UTC+8).
   - React 19 render purity enforced: Zero `Date.now()` calls during component render. All calculations happen in server service functions.
3. **Pessimistic Concurrency & Idempotency:**
   - Leases use PostgreSQL `btree_gist` exclusion constraints to block overlapping date ranges on the same unit.
   - Payment recording acquires row locks via `SELECT ... FROM leases WHERE id = ... FOR UPDATE` to prevent concurrent cap breaches.
   - Webhook processing locks bills with `SELECT ... FROM gateway_bills WHERE id = ... FOR UPDATE` and validates signatures with `crypto.timingSafeEqual`.
4. **Multi-Tenant Isolation & RLS:**
   - Supabase Row Level Security (RLS) enabled on all tables; anonymous access is completely revoked.
   - Cross-organization queries return `404 Not Found` (never 403) to prevent resource enumeration.
5. **Feature-Based Modular UI:**
   - Thin `page.tsx` boundaries in App Router compose domain components under `src/features/dashboard/`, `src/features/tenant/`, and `src/components/ui/` (shadcn/ui).

---

## 📁 Key Files & Submission Deliverables
- [`REVIEW.md`](./REVIEW.md): Comprehensive Part B pull request code review ordered from most to least severe.
- [`DECISIONS.md`](./DECISIONS.md): Architectural decisions and defense answers for Part C (under 150 words with exact line references).
- [`prisma/schema.prisma`](./prisma/schema.prisma): Complete data model with integer sen amounts and audit logs.
- [`supabase/migrations/`](./supabase/migrations/): SQL migrations for initial schema, exclusion constraints, and RLS policies.
- [`src/scripts/seed.ts`](./src/scripts/seed.ts) / [`src/lib/seed.ts`](./src/lib/seed.ts): Automated database seeding script.
