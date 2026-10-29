'use client'

import { useState } from 'react'
import { loginAction } from '@/app/auth/actions'
import { toast } from 'sonner'
import { Building2, Lock, Mail, ArrowRight, ShieldCheck } from 'lucide-react'

const QUICK_ACCOUNTS = [
  { label: 'Northwind Manager', email: 'manager@northwind.test', role: 'manager' },
  { label: 'Northwind Staff', email: 'staff@northwind.test', role: 'staff' },
  { label: 'Northwind Tenant (Aisyah)', email: 'aisyah@northwind.test', role: 'tenant' },
  { label: 'Beta Realty Manager', email: 'manager@beta.test', role: 'manager' },
  { label: 'Beta Realty Tenant (Chen)', email: 'chen@beta.test', role: 'tenant' },
]

export default function LoginPage() {
  const [email, setEmail] = useState('manager@northwind.test')
  const [password, setPassword] = useState('Password123!')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)

    const formData = new FormData()
    formData.append('email', email)
    formData.append('password', password)

    try {
      const res = await loginAction(formData)
      if (res?.error) {
        toast.error(res.error)
        setLoading(false)
      }
    } catch {
      // redirect() throws an internal Next.js error when navigation starts, which is expected
    }
  }

  function handleSelectQuick(accEmail: string) {
    setEmail(accEmail)
    setPassword('Password123!')
    toast.info(`Selected ${accEmail}`)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-slate-900 text-white rounded-xl flex items-center justify-center mx-auto shadow-sm">
            <Building2 className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Rent Collection System</h1>
          <p className="text-sm text-slate-500">EzyFusion Group • Multi-Tenant Property Management</p>
        </div>

        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="user@organization.test"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-lg text-sm shadow-sm transition disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : 'Sign In'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-100">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-3">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Quick Test Accounts (Assessment Grader)</span>
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              {QUICK_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => handleSelectQuick(acc.email)}
                  className="w-full text-left px-2.5 py-1.5 text-xs rounded-md bg-slate-50 hover:bg-slate-100 border border-slate-200/60 flex items-center justify-between transition"
                >
                  <span className="font-medium text-slate-700">{acc.label}</span>
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-200/70 text-slate-600">
                    {acc.role}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

