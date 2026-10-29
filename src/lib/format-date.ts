import { BUSINESS_CONFIG } from '@/lib/constants'

/**
 * Formats calendar date into Malaysia time (Asia/Kuala_Lumpur) consistently.
 * Safe for SSR and client hydration across all client timezones.
 */
export function formatMalaysiaDate(date: Date | string | null | undefined): string {
  if (!date) return '-'
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('en-MY', {
    timeZone: BUSINESS_CONFIG.TIMEZONE,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(d)
}

/**
 * Formats timestamp into Malaysia date and time.
 */
export function formatMalaysiaDateTime(date: Date | string | null | undefined): string {
  if (!date) return '-'
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('en-MY', {
    timeZone: BUSINESS_CONFIG.TIMEZONE,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(d)
}

/**
 * Formats integer sen into formatted Ringgit string (e.g. 150000 -> "RM 1,500.00").
 */
export function formatRinggit(sen: number | bigint | null | undefined): string {
  if (sen === null || sen === undefined) return 'RM 0.00'
  const val = Number(sen) / BUSINESS_CONFIG.SEN_PER_RINGGIT
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: BUSINESS_CONFIG.CURRENCY,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val)
}

