'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { ROUTES } from '@/lib/routes'
import { Button } from '@/components/ui/button'
import { CreditCard, X, Terminal, ExternalLink } from 'lucide-react'
import { formatRinggit } from '@/lib/format-date'
import Link from 'next/link'

interface TenantPayButtonProps {
  leaseId: string
  amountDueSen: number
}

export function TenantPayButton({ leaseId, amountDueSen }: TenantPayButtonProps) {
  const [loading, setLoading] = useState(false)
  const [createdBill, setCreatedBill] = useState<{ billId: string; amountSen: number } | null>(null)

  async function handlePayNow() {
    if (amountDueSen <= 0) {
      toast.info('No overdue or pending invoices due at this time')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(ROUTES.API.GATEWAY_BILLS(leaseId), {
        method: 'POST',
      })
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Failed to initialize payment gateway')
        return
      }

      setCreatedBill(data)
      toast.success('Gateway bill generated successfully!')
    } catch {
      toast.error('Network error during gateway bill creation')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handlePayNow}
        disabled={loading || amountDueSen <= 0}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition shadow-sm disabled:opacity-50 cursor-pointer"
      >
        <CreditCard className="w-4 h-4" />
        {loading ? 'Initializing...' : `Pay Now (${formatRinggit(amountDueSen)})`}
      </button>

      {createdBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <CreditCard className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Payment Gateway Simulator</h3>
              </div>
              <button
                type="button"
                onClick={() => setCreatedBill(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-sm">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Bill Identifier</span>
                  <span className="font-mono font-bold text-slate-800">{createdBill.billId}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Amount Due</span>
                  <span className="font-mono font-bold text-slate-900">{formatRinggit(createdBill.amountSen)}</span>
                </div>
              </div>

              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                  1. Settle via Terminal Simulator
                </span>
                <div className="bg-slate-950 text-slate-100 p-3 rounded-lg text-xs font-mono overflow-x-auto flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-400 shrink-0" />
                  <code>
                    node gateway-sim.mjs {createdBill.billId} {createdBill.amountSen} true
                  </code>
                </div>
              </div>

              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                  2. Tenant Return Page
                </span>
                <p className="text-xs text-slate-500 mb-2">
                  Once settled via webhook, verify the read-only return status page:
                </p>
                <Link
                  href={`${ROUTES.PAYMENT_RETURN}?bill_id=${createdBill.billId}&paid=true`}
                  target="_blank"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800"
                >
                  Open {ROUTES.PAYMENT_RETURN}?bill_id={createdBill.billId}
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setCreatedBill(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
