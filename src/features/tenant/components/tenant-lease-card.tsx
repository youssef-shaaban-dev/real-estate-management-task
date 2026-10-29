import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TenantPayButton } from '@/components/tenant-pay-button'
import { formatMalaysiaDate, formatRinggit } from '@/lib/format-date'

interface TenantLeaseCardProps {
  tenantName: string
  unitName: string
  startDate: string | Date
  endDate: string | Date
  leaseId: string
  amountDueSen: number
}

export function TenantLeaseCard({
  tenantName,
  unitName,
  startDate,
  endDate,
  leaseId,
  amountDueSen,
}: TenantLeaseCardProps) {
  return (
    <Card className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 p-6 sm:p-8">
      <div>
        <div className="flex items-center gap-2">
          <Badge variant="success" className="text-[11px]">
            Unit {unitName} • Active Lease
          </Badge>
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900 mt-2">Hello, {tenantName}</h1>
        <p className="text-xs text-slate-500 mt-1">
          Term: {formatMalaysiaDate(startDate)} → {formatMalaysiaDate(endDate)}
        </p>
      </div>

      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col sm:items-end gap-2">
        <span className="text-xs font-semibold text-slate-500 uppercase">Amount Due Now (MYT)</span>
        <span className="text-2xl font-black text-slate-900">{formatRinggit(amountDueSen)}</span>
        <TenantPayButton leaseId={leaseId} amountDueSen={amountDueSen} />
      </div>
    </Card>
  )
}
