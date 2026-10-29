# Code Review: Pull Request Evaluation

This document reviews the proposed pull request containing `app/api/leases/[leaseId]/late-fees/route.ts`, `app/api/webhooks/gateway/route.ts`, and `app/(staff)/dashboard/actions.ts`.

Issues are ordered from most to least severe.

---

### Issue 1: Privilege Escalation via Untrusted `user_metadata`
- **File & Lines:** `app/api/leases/[leaseId]/late-fees/route.ts`, Lines 318–321
- **Severity:** Critical (Security / Authorization Bypass)
- **Concrete Scenario:**
  The endpoint verifies authorization using `if (user?.user_metadata.role !== 'manager')`. In Supabase Auth, `user_metadata` is editable by authenticated users through client SDK calls (e.g. `supabase.auth.updateUser({ data: { role: 'manager' } })`) or can be set during user self-registration. A tenant or low-privilege staff member can forge their own `user_metadata.role` to `'manager'` and successfully trigger late fees on any lease.
- **Fix:**
  Authenticate against the trusted database table (`memberships`). Query the user's relational membership record for the lease's organization:
  ```ts
  const auth = await getAuthContext()
  if (auth.role !== MemberRole.manager) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  ```

---

### Issue 2: Cross-Tenant Data Access (IDOR / Multi-Tenant Isolation Breach)
- **File & Lines:** `app/api/leases/[leaseId]/late-fees/route.ts`, Lines 324–328
- **Severity:** Critical (Security / Cross-Tenant Breach)
- **Concrete Scenario:**
  The query `prisma.lease.findUnique({ where: { id: leaseId } })` executes as the Postgres database owner (`prisma` connection) and completely bypasses RLS without filtering by `orgId`. A manager belonging to Organization A can send a POST request with the `leaseId` belonging to Organization B. The endpoint will access Organization B's lease and insert late fee invoices into Organization B's financial ledger. Furthermore, if a non-existent lease ID is passed, returning 404 vs 403 leaks whether a lease exists across tenant boundaries.
- **Fix:**
  Scope the query strictly to the caller's organization and return `404 Not Found` for any foreign or nonexistent lease:
  ```ts
  const lease = await prisma.lease.findFirst({
    where: { id: leaseId, orgId: auth.orgId },
    include: { invoices: { include: { allocations: true } } },
  })
  if (!lease) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  ```

---

### Issue 3: Webhook Concurrency Race Condition (Double Payment Creation)
- **File & Lines:** `app/api/webhooks/gateway/route.ts`, Lines 25–41
- **Severity:** High (Data Integrity & Financial Loss)
- **Concrete Scenario:**
  The payment gateway delivers webhook callbacks concurrently (e.g. duplicate retry 5 ms apart). Both requests execute `const bill = await prisma.gatewayBill.findUnique({ where: { id: fields.id } })` at the same time. Both see `bill.status === 'pending'` (neither has updated yet). Both proceed into separate transactions, update `gatewayBill.status = 'paid'`, create two distinct `payment` records crediting the tenant twice, and allocate double the money across invoices.
- **Fix:**
  Acquire a pessimistic row lock inside a single transaction using `SELECT ... FOR UPDATE`, and verify status inside the lock:
  ```ts
  await prisma.$transaction(async (tx) => {
    const [bill] = await tx.$queryRaw<GatewayBill[]>`
      SELECT * FROM gateway_bills WHERE id = ${fields.id} FOR UPDATE
    `
    if (!bill) throw new HttpError(404, 'Unknown bill')
    if (bill.status === 'paid') return // Idempotent return
    await tx.gatewayBill.update({ where: { id: bill.id }, data: { status: 'paid' } })
    // create payment and allocate
  })
  ```

---

### Issue 4: Timing Attack on Webhook Signature Verification
- **File & Lines:** `app/api/webhooks/gateway/route.ts`, Lines 20–23
- **Severity:** High (Cryptographic Vulnerability)
- **Concrete Scenario:**
  The signature comparison uses the JavaScript strict inequality operator: `if (expected !== fields.x_signature)`. Standard string comparison terminates early on the first differing byte. An attacker measuring network round-trip time differences can perform a timing attack to incrementally guess HMAC signature bytes, allowing forged gateway callbacks.
- **Fix:**
  Use Node.js's constant-time comparison `crypto.timingSafeEqual`:
  ```ts
  import crypto from 'node:crypto'
  const valid = expected.length === fields.x_signature?.length &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(fields.x_signature))
  if (!valid) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  ```

---

### Issue 5: Missing Webhook Amount Verification
- **File & Lines:** `app/api/webhooks/gateway/route.ts`, Line 33
- **Severity:** High (Financial Integrity)
- **Concrete Scenario:**
  The webhook creates an approved payment with `amountSen: BigInt(fields.paid_amount)` without verifying whether `paid_amount` equals `bill.amountSen`. A tenant could pay a modified or partial amount (e.g. RM 1 for an RM 1,000 bill), and the system would mark the entire bill as `paid` while under-crediting the balance, or conversely over-crediting if a forged payload specifies a large amount.
- **Fix:**
  Enforce exact amount equality before accepting payment:
  ```ts
  if (BigInt(fields.paid_amount) !== bill.amountSen) {
    return NextResponse.json({ error: 'Amount mismatch' }, { status: 422 })
  }
  ```

---

### Issue 6: Non-Atomic Invoice Reference Generation Race Condition
- **File & Lines:** `app/api/leases/[leaseId]/late-fees/route.ts`, Lines 344 & 353–356
- **Severity:** High (Database Inconsistency / Constraint Violations)
- **Concrete Scenario:**
  Inside the invoice creation loop, `await nextReference(lease.orgId)` executes `prisma.invoice.findFirst` for every fee, and all creations are batched with `Promise.all(fees)`. Because all `nextReference` calls execute concurrently before any new invoice is inserted, each call reads the exact same `last.reference`. If a lease has 3 overdue invoices, all 3 created late fees receive identical references (e.g., `INV-12`), causing database unique constraint violations or corrupted invoice references.
- **Fix:**
  Generate invoice references sequentially inside a transaction, or use an atomic database sequence (`CREATE SEQUENCE`) or atomic counter row locked with `FOR UPDATE`.

---

### Issue 7: Truncating Collections Timestamp in Session/UTC Timezone Instead of Malaysia Time
- **File & Lines:** `app/(staff)/dashboard/actions.ts`, Lines 8–10
- **Severity:** Medium (Business Logic / Reporting Inaccuracy)
- **Concrete Scenario:**
  `date_trunc('month', received_at)` runs against PostgreSQL's session timezone (UTC). A payment received on `2026-03-01 00:30:00` Malaysia time (UTC+8) is stored in UTC as `2026-02-28 16:30:00+00`. `date_trunc('month', received_at)` resolves to `2026-02-01`, incorrectly categorizing the collection under February instead of March in statutory accounting reports.
- **Fix:**
  Explicitly convert the instant to Malaysia timezone before truncating:
  ```sql
  SELECT to_char(date_trunc('month', received_at AT TIME ZONE 'Asia/Kuala_Lumpur'), 'YYYY-MM') AS month,
         SUM(amount_sen) AS total
  FROM payments
  WHERE org_id = ${orgId}::uuid AND status = 'approved'
    AND (received_at AT TIME ZONE 'Asia/Kuala_Lumpur') >= ${from}::timestamp
    AND (received_at AT TIME ZONE 'Asia/Kuala_Lumpur') < (${to}::timestamp + interval '1 month')
  GROUP BY 1 ORDER BY 1
  ```

---

### Issue 8: Missing Zero-Filled Months in Collections Query
- **File & Lines:** `app/(staff)/dashboard/actions.ts`, Lines 8–13
- **Severity:** Medium (Contract Requirement / Chart Rendering Bug)
- **Concrete Scenario:**
  The query groups strictly by existing payments (`GROUP BY 1`). If no payments occurred in February 2026 within a range of `2026-01` to `2026-06`, February is omitted from the result set. The dashboard chart will skip months or fail contract expectations requiring all requested calendar months to be present.
- **Fix:**
  Generate the full month sequence (via `generate_series` in SQL or TypeScript zero-fill utility) and `LEFT JOIN` the aggregated payments.

---

### Issue 9: Floating-Point Math for Money and Percentage Checks
- **File & Lines:** `app/api/leases/[leaseId]/late-fees/route.ts`, Lines 338–340
- **Severity:** Medium (Financial Precision Violation)
- **Concrete Scenario:**
  The code uses floating-point arithmetic:
  `Number(paid) / Number(invoice.amountSen) >= 0.995` and `Math.round((Number(invoice.amountSen - paid) * 2) / 100)`.
  JavaScript `Number` is IEEE-754 double precision. Floating-point conversions introduce rounding errors and off-by-one sen discrepancies.
- **Fix:**
  Perform all money math using integer sen arithmetic:
  ```ts
  const remaining = invoice.amountSen - paid
  // Paid ratio >= 99.5% check: paid * 1000n >= invoice.amountSen * 995n
  if (paid * 1000n >= invoice.amountSen * 995n) continue
  // 2% fee with round half-up: ((remaining * 2n) + 50n) / 100n
  const feeSen = ((remaining * 2n) + 50n) / 100n
  ```

---

### Issue 10: Missing Authorization Check on Server Action `getCollections`
- **File & Lines:** `app/(staff)/dashboard/actions.ts`, Lines 6–7
- **Severity:** Medium (Security / Unauthorized Data Access)
- **Concrete Scenario:**
  `getCollections(orgId: string, from: string, to: string)` is an exported Next.js Server Action (`'use server'`). Server Actions are public POST endpoints. Any user can call this action directly with an arbitrary `orgId` to inspect financial collection totals of other companies without authorization.
- **Fix:**
  Validate the caller's session via `getAuthContext()` and verify that `auth.orgId === orgId` and `auth.role` is staff or manager before executing the query.

---

### Suspicious but Correct (Not a Bug)
- **`app/api/leases/[leaseId]/late-fees/route.ts`, Line 316:** `params: Promise<{ leaseId: string }>`: In Next.js 15+, dynamic route `params` is a Promise and must be awaited with `await params`. This is correct.
- **`app/api/webhooks/gateway/route.ts`, Line 12:** `await req.formData()`: In Node/Next.js fetch API, `req.formData()` correctly parses both `multipart/form-data` and `application/x-www-form-urlencoded` payloads sent by gateway webhooks.
