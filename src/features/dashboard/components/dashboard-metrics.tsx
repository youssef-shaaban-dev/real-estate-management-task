import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ROUTES } from '@/lib/routes'
import { formatRinggit } from '@/lib/format-date'
import { AlertCircle, TrendingUp, FileText, ArrowRight } from 'lucide-react'
import type { DashboardMetricsProps } from '../types'

export function DashboardMetrics({
  overdueCount,
  total6MonthCollectedSen,
}: DashboardMetricsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardDescription className="uppercase tracking-wider font-semibold text-xs text-slate-500">
            Overdue Invoices
          </CardDescription>
          <div
            className={`p-2 rounded-lg ${
              overdueCount > 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
            }`}
          >
            <AlertCircle className="w-5 h-5" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{overdueCount}</span>
            {overdueCount > 0 ? (
              <Badge variant="danger">Action Required</Badge>
            ) : (
              <Badge variant="success">All Current</Badge>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-2">Requiring immediate tenant follow-up</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardDescription className="uppercase tracking-wider font-semibold text-xs text-slate-500">
            6-Month Total Collected
          </CardDescription>
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
            <TrendingUp className="w-5 h-5" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-extrabold text-slate-900">
            {formatRinggit(total6MonthCollectedSen)}
          </div>
          <p className="text-xs text-slate-500 mt-2">Approved payments across all leases</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardDescription className="uppercase tracking-wider font-semibold text-xs text-slate-500">
            Active Leases
          </CardDescription>
          <div className="p-2 bg-slate-100 text-slate-700 rounded-lg">
            <FileText className="w-5 h-5" />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">Lease Operations</span>
            <Link href={ROUTES.LEASES}>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                Manage Leases
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
          <p className="text-xs text-slate-500">Record payments and inspect rent schedules</p>
        </CardContent>
      </Card>
    </div>
  )
}
