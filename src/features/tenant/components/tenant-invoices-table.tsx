import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatMalaysiaDate, formatRinggit } from '@/lib/format-date'

interface InvoiceItem {
  id: string
  kind: string
  periodIndex: number | null
  periodStart: string | null
  periodEnd: string | null
  dueDate: string
  amountSen: number
  paidSen: number
  status: string
}

interface TenantInvoicesTableProps {
  invoices: InvoiceItem[]
  monthlyRentSen: number
}

const statusVariants: Record<string, 'success' | 'info' | 'secondary' | 'danger'> = {
  paid: 'success',
  partially_paid: 'info',
  unpaid: 'secondary',
  overdue: 'danger',
}

export function TenantInvoicesTable({ invoices, monthlyRentSen }: TenantInvoicesTableProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle>Your Invoices</CardTitle>
        <span className="text-xs text-slate-500 font-mono">
          Monthly Rent: {formatRinggit(monthlyRentSen)}
        </span>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Description</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Due Date (MYT)</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Paid</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((inv) => (
              <TableRow key={inv.id}>
                <TableCell className="capitalize font-medium text-slate-900">
                  {inv.kind === 'deposit' ? 'Security Deposit' : `Rent (Period #${inv.periodIndex})`}
                </TableCell>
                <TableCell className="text-xs text-slate-600">
                  {inv.periodStart
                    ? `${formatMalaysiaDate(inv.periodStart)} → ${formatMalaysiaDate(inv.periodEnd!)}`
                    : '-'}
                </TableCell>
                <TableCell className="text-xs font-medium text-slate-700">
                  {formatMalaysiaDate(inv.dueDate)}
                </TableCell>
                <TableCell className="font-medium text-slate-900">{formatRinggit(inv.amountSen)}</TableCell>
                <TableCell className="font-medium text-slate-900">{formatRinggit(inv.paidSen)}</TableCell>
                <TableCell>
                  <Badge variant={statusVariants[inv.status] || 'secondary'}>
                    {inv.status.replace('_', ' ')}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
