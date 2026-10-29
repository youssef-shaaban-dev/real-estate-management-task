'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { STORAGE } from '@/lib/constants'
import { toast } from 'sonner'
import { FileText, ExternalLink } from 'lucide-react'

export function SlipLink({ slipPath }: { slipPath: string | null | undefined }) {
  const [loading, setLoading] = useState(false)

  if (!slipPath) return null
  const validPath = slipPath

  async function handleOpenSlip() {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase.storage
        .from(STORAGE.PAYMENT_SLIPS_BUCKET)
        .createSignedUrl(validPath, 60)

      if (error || !data?.signedUrl) {
        toast.error('Unable to generate secure slip URL')
        return
      }

      window.open(data.signedUrl, '_blank')
    } catch {
      toast.error('Failed to open slip file')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleOpenSlip}
      disabled={loading}
      className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 transition disabled:opacity-50"
    >
      <FileText className="w-3.5 h-3.5" />
      {loading ? 'Opening...' : 'View Slip'}
      <ExternalLink className="w-3 h-3" />
    </button>
  )
}
