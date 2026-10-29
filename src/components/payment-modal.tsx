'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { parseRinggitToSen } from '@/lib/billing'
import { createClient } from '@/lib/supabase/client'
import { PaymentMethod, STORAGE } from '@/lib/constants'
import { ROUTES } from '@/lib/routes'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Plus, X, Upload } from 'lucide-react'

interface RecordPaymentModalProps {
  leaseId: string
  orgId: string
  userRole: string
  defaultReceivedAt: string
}

export function RecordPaymentModal({
  leaseId,
  orgId,
  userRole,
  defaultReceivedAt,
}: RecordPaymentModalProps) {
  const [open, setOpen] = useState(false)
  const [amountInput, setAmountInput] = useState('')
  const [method, setMethod] = useState<PaymentMethod>(PaymentMethod.cash)
  const [receivedAt, setReceivedAt] = useState(defaultReceivedAt)
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)

    // 1. Parse ringgit using pure billing function
    let amountSen: number
    try {
      amountSen = parseRinggitToSen(amountInput)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Invalid ringgit amount format')
      setLoading(false)
      return
    }

    if (amountSen <= 0) {
      toast.error('Payment amount must be greater than zero')
      setLoading(false)
      return
    }

    // 2. Handle file upload for bank transfer
    let slipPath: string | undefined
    if (method === PaymentMethod.bank_transfer) {
      if (!file) {
        toast.error('Please upload a bank transfer slip (JPEG, PNG or PDF under 5MB)')
        setLoading(false)
        return
      }

      if (file.size > STORAGE.MAX_SLIP_SIZE_BYTES) {
        toast.error('Slip file exceeds 5MB limit')
        setLoading(false)
        return
      }

      try {
        const supabase = createClient()
        const fileExt = file.name.split('.').pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${fileExt}`
        const storagePath = `${orgId}/slips/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from(STORAGE.PAYMENT_SLIPS_BUCKET)
          .upload(storagePath, file, { contentType: file.type })

        if (uploadError) {
          toast.error(`Slip upload failed: ${uploadError.message}`)
          setLoading(false)
          return
        }

        slipPath = storagePath
      } catch {
        toast.error('Network error during slip upload')
        setLoading(false)
        return
      }
    }

    // 3. Post to payment API with UUID idempotency key
    const idempotencyKey = crypto.randomUUID()
    const receivedAtIso = `${receivedAt}:00+08:00`

    try {
      const res = await fetch(ROUTES.API.LEASE_PAYMENTS(leaseId), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          amountSen,
          method,
          receivedAt: receivedAtIso,
          slipPath,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Failed to record payment')
        setLoading(false)
        return
      }

      toast.success(
        data.status === 'approved'
          ? 'Payment recorded and approved immediately!'
          : 'Payment recorded! Awaiting manager verification.'
      )
      setOpen(false)
      setAmountInput('')
      setFile(null)
      router.refresh()
    } catch {
      toast.error('Failed to submit payment request')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        className="cursor-pointer"
      >
        <Plus className="w-4 h-4 mr-1" />
        Record Payment
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Record Lease Payment</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-600 rounded-lg p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                  Amount in Ringgit (e.g. 1,500.00)
                </label>
                <input
                  type="text"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  placeholder="1,500.00"
                  required
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Payment Method</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMethod(PaymentMethod.cash)}
                    className={`py-2 text-xs font-medium rounded-lg border transition cursor-pointer ${
                      method === PaymentMethod.cash
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Cash
                  </button>
                  <button
                    type="button"
                    onClick={() => setMethod(PaymentMethod.bank_transfer)}
                    className={`py-2 text-xs font-medium rounded-lg border transition cursor-pointer ${
                      method === PaymentMethod.bank_transfer
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Bank Transfer
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                  Received Date & Time (Malaysia Time)
                </label>
                <input
                  type="datetime-local"
                  value={receivedAt}
                  onChange={(e) => setReceivedAt(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
                />
              </div>

              {method === PaymentMethod.bank_transfer && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                    Transfer Slip (JPEG, PNG, PDF ≤ 5MB)
                  </label>
                  <div className="relative border border-dashed border-slate-300 rounded-lg p-4 text-center hover:bg-slate-50 transition">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,application/pdf"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                      required
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <Upload className="w-5 h-5 text-slate-400 mx-auto mb-1" />
                    <span className="text-xs text-slate-600 block truncate">
                      {file ? file.name : 'Choose file or drag & drop'}
                    </span>
                  </div>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                >
                  {loading ? 'Recording...' : userRole === 'manager' ? 'Record & Approve' : 'Submit for Verification'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
