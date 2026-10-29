import { logoutAction } from '@/app/auth/actions'
import { Button } from '@/components/ui/button'
import { Building2, LogOut } from 'lucide-react'

interface TenantHeaderProps {
  tenantName: string
  organizationName: string
}

export function TenantHeader({ tenantName, organizationName }: TenantHeaderProps) {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-slate-900 text-white rounded-lg flex items-center justify-center">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <span className="font-bold text-slate-900 text-sm block">Tenant Portal</span>
            <span className="text-xs text-slate-500 block">{organizationName}</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-xs font-medium text-slate-700 hidden sm:inline">{tenantName}</span>
          <form action={logoutAction}>
            <Button
              type="submit"
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs text-slate-600 hover:text-slate-900"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </Button>
          </form>
        </div>
      </div>
    </header>
  )
}
