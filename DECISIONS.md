# Architectural Decisions (Part C)

### 1. Gateway Duplicate Delivery (5 ms Apart)
When two identical `paid=true` callbacks arrive concurrently, both execute `processGatewayWebhookService` in [`src/lib/services/gateway.service.ts`](file:///e:/Projects/real-estate-mangement-task/src/lib/services/gateway.service.ts#L130-L153). Inside `prisma.$transaction`, line 132 issues a pessimistic row lock: `SELECT ... FROM gateway_bills WHERE id = ${billId} FOR UPDATE`.
- **Request 1:** Acquires the row lock first. It sees `bill.status === BillStatus.pending`, updates the bill to `paid` (line 155), creates the approved payment (line 168), allocates it to invoices (line 180), and commits.
- **Request 2:** Blocks on the row lock at line 132 until Request 1 commits. Upon acquiring the lock, it reads the updated state where `bill.status === BillStatus.paid`. At line 150, the guard triggers:
  ```ts
  if (bill.status === BillStatus.paid) { return { ok: true } }
  ```
It exits immediately without creating a second payment or allocating further funds, ensuring strict idempotency.

---

### 2. Concurrent Payment Cap Conflict
When two staff members attempt to record RM 800 and RM 700 simultaneously on a lease with RM 1,000 remaining balance, both execute `recordPaymentService` in [`src/lib/services/payment.service.ts`](file:///e:/Projects/real-estate-mangement-task/src/lib/services/payment.service.ts#L103-L146).
Inside `prisma.$transaction`, line 112 executes a row lock on the parent lease:
```sql
SELECT id FROM leases WHERE id = ${leaseId}::uuid FOR UPDATE
```
- **Transaction A:** Acquires the lock first. It computes remaining balance (RM 1,000) minus pending payments (RM 0), establishing a `cap` of RM 1,000 (line 141). Since RM 800 <= RM 1,000, it creates a `pending_verification` payment for RM 800 (lines 153–160) and commits.
- **Transaction B:** Suspends until Transaction A completes. Upon unblocking and acquiring the lock, it re-queries invoices and pending payments. `totalPending` now includes Transaction A's RM 800, reducing the available `cap` to RM 200. At line 144:
  ```ts
  if (paymentAmountBigInt > cap) throw new PaymentError(422, 'Payment exceeds the remaining balance cap')
  ```
Transaction B is rejected with HTTP 422, preventing cap breaches.

---

### 3. Inventory of "Today" and Calendar Date / Instant Conversions
1. **[`src/lib/billing.ts`](file:///e:/Projects/real-estate-mangement-task/src/lib/billing.ts#L122-L136) (`invoiceStatus`):** Converts instant `asOf` to Malaysia calendar date using UTC+8 offset (`+ 8 * 3600 * 1000`). *Why:* Malaysian property law defines overdue status by midnight of Malaysian business days, independent of UTC.
2. **[`src/lib/services/report.service.ts`](file:///e:/Projects/real-estate-mangement-task/src/lib/services/report.service.ts#L44-L52):** Truncates `received_at` in SQL: `date_trunc('month', received_at AT TIME ZONE 'Asia/Kuala_Lumpur')`. *Why:* Payments received on March 1 at 00:30 MYT (UTC Feb 28 16:30) must legally be counted in March's Malaysian statutory accounts.
3. **[`src/lib/services/gateway.service.ts`](file:///e:/Projects/real-estate-mangement-task/src/lib/services/gateway.service.ts#L33-L41,L161-L167):**
   - Filters billable invoices where `dueDate <= todayMyt`. *Why:* Only amounts legally due today in Malaysia may be billed.
   - Parses gateway `paid_at` with offset (e.g. `+0800`) into a UTC instant for storage.
4. **[`src/lib/format-date.ts`](file:///e:/Projects/real-estate-mangement-task/src/lib/format-date.ts#L1-L24):** Formats all UI dates/times with `timeZone: 'Asia/Kuala_Lumpur'`. *Why:* Guarantees consistent Malaysia Time display regardless of viewer locale.

---

### 4. Non-RLS Queries and Authorization Enforcement
1. **Prisma ORM Queries ([`src/lib/prisma.ts`](file:///e:/Projects/real-estate-mangement-task/src/lib/prisma.ts)):**
   Prisma connects via `DATABASE_URL` as the database owner, bypassing PostgreSQL RLS.
   *Enforcement:* The server-side authorization layer ([`src/lib/auth.ts`](file:///e:/Projects/real-estate-mangement-task/src/lib/auth.ts)) validates the user session via Supabase Auth and queries trusted `memberships` and `tenants` tables directly (ignoring unverified `user_metadata`). Every service function ([`src/lib/services/`](file:///e:/Projects/real-estate-mangement-task/src/lib/services/)) explicitly filters queries by `auth.orgId` or `auth.tenantId`. Queries referencing another organization return `404 Not Found` (never 403) to prevent information disclosure.
2. **Supabase Service Role Client ([`src/lib/supabase/admin.ts`](file:///e:/Projects/real-estate-mangement-task/src/lib/supabase/admin.ts)):**
   Used for payment slip validation and signed URL generation in [`src/lib/services/payment.service.ts`](file:///e:/Projects/real-estate-mangement-task/src/lib/services/payment.service.ts#L31-L59).
   *Enforcement:* Storage paths are strictly checked to ensure they start with `${auth.orgId}/`. Unauthorized paths are rejected before interacting with the storage API.

---

### 5. Voiding Payments with Existing Online `unapplied_sen`
When a payment is voided in [`src/lib/services/payment.service.ts`](file:///e:/Projects/real-estate-mangement-task/src/lib/services/payment.service.ts#L283-L337), our system deletes the allocations belonging specifically to the voided payment (`tx.paymentAllocation.deleteMany({ where: { paymentId } })`), sets its status to `voided`, and sets its `unappliedSen = 0`.
It intentionally does **NOT** automatically re-allocate existing `unappliedSen` from older online payments onto the reopened invoices.

*Rationale:*
1. **Financial Audit Trail Immutability:** Allocations represent point-in-time accounting settlements. Silently mutating an earlier approved payment's allocation to absorb reopened invoices distorts historical ledger records without an explicit transaction.
2. **Explicit Manager Discretion:** The unapplied surplus remains securely credited to the tenant under the original online payment. The manager can deliberately inspect the account and decide whether to apply the credit to future periods, issue a refund, or reallocate manually.

---

### 6. AI Errors and Corrections During Assessment
1. **BigInt Literal Syntax with Target ES2017:**
   The AI assistant initially used `0n` BigInt literal syntax across `billing.ts` and `allocation.ts`. Next.js 16's TypeScript compiler targeted ES2017 where BigInt literals are unsupported, causing `error TS2737: BigInt literals are not available when targeting lower than ES2020`. I noticed the build failure during `pnpm build` and replaced all literal instances with `BigInt(0)`.
2. **React 19 Render Purity (`Date.now` During Component Render):**
   The AI initially invoked `new Date(Date.now() + 8*3600*1000)` directly inside the render body of Next.js page components (`src/app/tenant/page.tsx`, `src/app/dashboard/page.tsx`). React 19's compiler flagged this with `Error: Cannot call impure function during render (react-hooks/purity)`. I caught this via `eslint` and resolved it by extracting all date and range computations into backend service functions (`src/lib/services/`), keeping components 100% pure.

