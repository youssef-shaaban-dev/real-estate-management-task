'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Phone, Check, Loader2 } from 'lucide-react'

interface TenantPhoneFormProps {
  tenantId: string
  initialPhone: string | null
}

export function TenantPhoneForm({ tenantId, initialPhone }: TenantPhoneFormProps) {
  const [phone, setPhone] = useState(initialPhone || '')
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setSaved(false)

    try {
      // Updates phone directly from browser using supabase-js and caller's access token
      const supabase = createClient()
      const { error } = await supabase
        .from('tenants')
        .update({ phone: phone.trim() })
        .eq('id', tenantId)

      if (error) {
        toast.error(`Failed to update phone: ${error.message}`)
        return
      }

      toast.success('Phone number updated successfully')
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      toast.error('Network error updating phone number')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleUpdate} className="flex items-center gap-2">
      <div className="relative">
        <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
        <input
          type="text"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+60123456789"
          className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 font-mono w-44"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : saved ? (
          <>
            <Check className="w-3 h-3 text-emerald-400" />
            Saved
          </>
        ) : (
          'Update'
        )}
      </button>
    </form>
  )
}

