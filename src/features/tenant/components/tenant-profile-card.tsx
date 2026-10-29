import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TenantPhoneForm } from '@/components/tenant-phone-form'

interface TenantProfileCardProps {
  tenantId: string
  fullName: string
  email: string
  phone: string
}

export function TenantProfileCard({
  tenantId,
  fullName,
  email,
  phone,
}: TenantProfileCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm uppercase tracking-wider text-slate-700">Contact Information</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-sm">
          <div>
            <span className="text-xs text-slate-400 block mb-1">Full Name</span>
            <span className="font-medium text-slate-800">{fullName}</span>
          </div>
          <div>
            <span className="text-xs text-slate-400 block mb-1">Email</span>
            <span className="font-medium text-slate-800">{email}</span>
          </div>
          <div>
            <span className="text-xs text-slate-400 block mb-1">Contact Phone (Click to Edit)</span>
            <TenantPhoneForm tenantId={tenantId} initialPhone={phone} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
