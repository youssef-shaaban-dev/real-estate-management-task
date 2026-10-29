import { Suspense } from 'react'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'

interface ReturnPageProps {
  searchParams: Promise<{
    bill_id?: string
    paid?: string
  }>
}

async function PaymentContent({ searchParams }: ReturnPageProps) {
  const { bill_id: billId } = await searchParams

  if (!billId) {
    return (
      <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
        <h1 className="text-xl font-bold text-slate-900 mb-2">Payment Verification</h1>
        <p className="text-sm text-slate-600 mb-6">No bill reference was provided in the return URL.</p>
        <Link
          href="/"
          className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition"
        >
          Return to Dashboard
        </Link>
      </div>
    )
  }

  // Strictly read-only: query bill state without modifying any record
  const bill = await prisma.gatewayBill.findUnique({
    where: { id: billId },
    include: {
      payment: true,
      lease: {
        include: { unit: true },
      },
    },
  })

  if (!bill) {
    return (
      <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
        <h1 className="text-xl font-bold text-red-600 mb-2">Bill Not Found</h1>
        <p className="text-sm text-slate-600 mb-6">
          We could not locate bill <span className="font-mono text-slate-800">{billId}</span> in our records.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition"
        >
          Return to Dashboard
        </Link>
      </div>
    )
  }

  const isSuccess = bill.status === 'paid'
  const isFailed = bill.status === 'failed'
  const ringgitFormatted = (Number(bill.amountSen) / 100).toFixed(2)

  return (
    <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-slate-200 p-8">
      <div className="text-center mb-6">
        <div
          className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-4 ${
            isSuccess
              ? 'bg-emerald-100 text-emerald-600'
              : isFailed
              ? 'bg-red-100 text-red-600'
              : 'bg-amber-100 text-amber-600'
          }`}
        >
          {isSuccess ? '✓' : isFailed ? '✕' : '⏳'}
        </div>
        <h1 className="text-xl font-bold text-slate-900">
          {isSuccess ? 'Payment Successful' : isFailed ? 'Payment Failed' : 'Payment Processing'}
        </h1>
        <p className="text-xs text-slate-500 mt-1">Ref: {bill.id}</p>
      </div>

      <div className="border-t border-b border-slate-100 py-4 mb-6 space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-500">Unit</span>
          <span className="font-medium text-slate-900">{bill.lease.unit.name}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Amount</span>
          <span className="font-medium text-slate-900">RM {ringgitFormatted}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Status</span>
          <span
            className={`font-semibold capitalize ${
              isSuccess ? 'text-emerald-600' : isFailed ? 'text-red-600' : 'text-amber-600'
            }`}
          >
            {bill.status}
          </span>
        </div>
      </div>

      <div className="text-center">
        <Link
          href="/"
          className="inline-flex w-full items-center justify-center px-4 py-2.5 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition"
        >
          Return to Dashboard
        </Link>
      </div>
    </div>
  )
}

export default function PaymentReturnPage(props: ReturnPageProps) {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <Suspense
        fallback={
          <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center text-slate-600">
            Loading payment status...
          </div>
        }
      >
        <PaymentContent {...props} />
      </Suspense>
    </main>
  )
}
