import { Navbar } from '@/components/navbar'
import { DashboardHeader } from './dashboard-header'
import { DashboardMetrics } from './dashboard-metrics'
import { CollectionsChart } from './collections-chart'
import type { DashboardViewProps } from '../types'

export function DashboardView({
  userEmail,
  role,
  orgName,
  overdueCount,
  total6MonthCollectedSen,
  collections,
  fromMonth,
  toMonth,
}: DashboardViewProps) {
  return (
    <div className="min-h-screen bg-slate-50/50">
      <Navbar userEmail={userEmail} role={role} orgName={orgName} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <DashboardHeader orgName={orgName} />

        <DashboardMetrics
          overdueCount={overdueCount}
          total6MonthCollectedSen={total6MonthCollectedSen}
        />

        <CollectionsChart
          collections={collections}
          fromMonth={fromMonth}
          toMonth={toMonth}
          totalCollectedSen={total6MonthCollectedSen}
        />
      </main>
    </div>
  )
}
