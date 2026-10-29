'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logoutAction } from '@/app/auth/actions'
import { ROUTES } from '@/lib/routes'
import { Badge } from '@/components/ui/badge'
import { Building2, LayoutDashboard, FileText, LogOut } from 'lucide-react'

interface NavbarProps {
  userEmail: string
  role: string
  orgName: string
}

export function Navbar({ userEmail, role, orgName }: NavbarProps) {
  const pathname = usePathname()

  const links = [
    { href: ROUTES.DASHBOARD, label: 'Dashboard', icon: LayoutDashboard },
    { href: ROUTES.LEASES, label: 'Leases', icon: FileText },
  ]

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center gap-8">
            <Link href={ROUTES.DASHBOARD} className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-slate-900 text-white rounded-xl flex items-center justify-center font-bold shadow-xs">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-slate-900 tracking-tight block text-sm">Rent Collection</span>
                <span className="text-[11px] text-slate-500 block leading-tight font-medium">{orgName}</span>
              </div>
            </Link>

            <nav className="flex space-x-1">
              {links.map((item) => {
                const Icon = item.icon
                const isActive =
                  pathname === item.href ||
                  (item.href !== ROUTES.DASHBOARD && pathname.startsWith(item.href))
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition ${
                      isActive
                        ? 'bg-slate-100 text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                )
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <span className="text-xs font-semibold text-slate-900 block">{userEmail}</span>
              <Badge variant="secondary" className="text-[10px] py-0 px-1.5 font-mono">
                {role}
              </Badge>
            </div>

            <form action={logoutAction}>
              <button
                type="submit"
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </header>
  )
}
