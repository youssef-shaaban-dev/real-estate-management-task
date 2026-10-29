import {
  MemberRole,
  InvoiceKind,
  PaymentMethod,
  PaymentStatus,
  BillStatus,
} from '@/generated/prisma/enums'

// ─── Re-exported Prisma Enums ────────────────────────────────────────────────
export {
  MemberRole,
  InvoiceKind,
  PaymentMethod,
  PaymentStatus,
  BillStatus,
}

// ─── Application Roles ───────────────────────────────────────────────────────
// System has 3 roles: staff and managers belong to organizations, tenants are renters
export const ROLES = {
  MANAGER: 'manager',
  STAFF: 'staff',
  TENANT: 'tenant',
} as const

export type AppRole = (typeof ROLES)[keyof typeof ROLES]

// ─── Audit Log Actions ───────────────────────────────────────────────────────
export const AUDIT_ACTIONS = {
  CREATE_LEASE: 'create_lease',
  RECORD_PAYMENT: 'record_payment',
  APPROVE_PAYMENT: 'approve_payment',
  REJECT_PAYMENT: 'reject_payment',
  VOID_PAYMENT: 'void_payment',
} as const

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS]

// ─── Storage Configuration ───────────────────────────────────────────────────
export const STORAGE = {
  PAYMENT_SLIPS_BUCKET: 'payment-slips',
  MAX_SLIP_SIZE_BYTES: 5 * 1024 * 1024, // 5 MB
  ALLOWED_SLIP_MIME_TYPES: ['image/jpeg', 'image/png', 'application/pdf'],
} as const

// ─── Business Rules & Timezone ───────────────────────────────────────────────
export const BUSINESS_CONFIG = {
  TIMEZONE: 'Asia/Kuala_Lumpur',
  UTC_OFFSET_HOURS: 8,
  UTC_OFFSET_MS: 8 * 60 * 60 * 1000,
  CURRENCY: 'MYR',
  SEN_PER_RINGGIT: 100,
  MIN_REASON_LENGTH: 5,
} as const

