export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  DASHBOARD: '/dashboard',
  LEASES: '/leases',
  LEASE_DETAILS: (id: string) => `/leases/${id}`,
  TENANT: '/tenant',
  PAYMENT_RETURN: '/payments/return',
  API: {
    LEASES: '/api/leases',
    LEASE_PAYMENTS: (leaseId: string) => `/api/leases/${leaseId}/payments`,
    GATEWAY_BILLS: (leaseId: string) => `/api/leases/${leaseId}/gateway-bills`,
    APPROVE_PAYMENT: (paymentId: string) => `/api/payments/${paymentId}/approve`,
    REJECT_PAYMENT: (paymentId: string) => `/api/payments/${paymentId}/reject`,
    VOID_PAYMENT: (paymentId: string) => `/api/payments/${paymentId}/void`,
    COLLECTIONS_REPORT: '/api/reports/collections',
    GATEWAY_WEBHOOK: '/api/webhooks/gateway',
  },
} as const
