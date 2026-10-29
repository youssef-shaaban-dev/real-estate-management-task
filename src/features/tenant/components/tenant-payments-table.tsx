import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatMalaysiaDateTime, formatRinggit } from '@/lib/format-date'

interface PaymentItem {
  id: string
  amountSen: number
  method: string
  status: string
  receivedAt: string
}

interface TenantPaymentsTableProps {
  payments: PaymentItem[]
}

export function TenantPaymentsTable({ payments }: TenantPaymentsTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment History</CardTitle>
      </CardHeader>
      <CardContent>
        {payments.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center">No payment transactions recorded yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date (MYT)</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-xs text-slate-700 whitespace-nowrap">
                    {formatMalaysiaDateTime(p.receivedAt)}
                  </TableCell>
                  <TableCell className="text-xs capitalize font-medium text-slate-800">
                    {p.method.replace('_', ' ')}
                  </TableCell>
                  <TableCell className="font-medium text-slate-900">{formatRinggit(p.amountSen)}</TableCell>
                  <TableCell>
                    <Badge variant={p.status === 'approved' ? 'success' : p.status === 'voided' ? 'danger' : 'secondary'}>
                      {p.status.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
