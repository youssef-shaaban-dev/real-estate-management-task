'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ROUTES } from '@/lib/routes'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Check, X, Ban } from 'lucide-react'

interface ManagerActionsProps {
  paymentId: string
  status: string
  isManager: boolean
}

export function ManagerActions({ paymentId, status, isManager }: ManagerActionsProps) {
  const [modalType, setModalType] = useState<'reject' | 'void' | null>(null)
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  if (!isManager) {
    return null
  }

  async function handleApprove() {
    setLoading(true)
    try {
      const res = await fetch(ROUTES.API.APPROVE_PAYMENT(paymentId), {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to approve payment')
        return
      }
      toast.success('Payment approved and allocated successfully!')
      router.refresh()
    } catch {
      toast.error('Network error during payment approval')
    } finally {
      setLoading(false)
    }
  }

  async function handleReasonSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!reason || reason.trim().length < 5) {
      toast.error('Reason must be at least 5 characters')
      return
    }

    setLoading(true)
    const endpoint =
      modalType === 'reject'
        ? ROUTES.API.REJECT_PAYMENT(paymentId)
        : ROUTES.API.VOID_PAYMENT(paymentId)

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      })
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || `Failed to ${modalType} payment`)
        return
      }

      toast.success(`Payment ${modalType}ed successfully`)
      setModalType(null)
      setReason('')
      router.refresh()
    } catch {
      toast.error(`Network error during payment ${modalType}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="flex items-center gap-1.5 justify-end">
        {status === 'pending_verification' && (
          <>
            <button
              type="button"
              onClick={handleApprove}
              disabled={loading}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition disabled:opacity-50 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              Approve
            </button>
            <button
              type="button"
              onClick={() => {
                setModalType('reject')
                setReason('')
              }}
              disabled={loading}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 transition disabled:opacity-50 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              Reject
            </button>
          </>
        )}

        {status === 'approved' && (
          <button
            type="button"
            onClick={() => {
              setModalType('void')
              setReason('')
            }}
            disabled={loading}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300 transition disabled:opacity-50 cursor-pointer"
          >
            <Ban className="w-3.5 h-3.5" />
            Void
          </button>
        )}
      </div>

      {modalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 capitalize">
              {modalType === 'reject' ? 'Reject Payment' : 'Confirm Payment Void'}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {modalType === 'reject'
                ? 'Please provide a clear reason for rejecting this verification request.'
                : 'Voiding this payment will remove all its allocations across invoices.'}
            </p>

            <form onSubmit={handleReasonSubmit} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                  Reason (min 5 characters)
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Enter detailed audit reason..."
                  required
                  minLength={5}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setModalType(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  variant={modalType === 'reject' ? 'destructive' : 'default'}
                  disabled={loading || reason.trim().length < 5}
                >
                  {loading ? 'Processing...' : modalType === 'reject' ? 'Reject' : 'Confirm Void'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
