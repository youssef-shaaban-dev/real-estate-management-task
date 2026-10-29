interface DashboardHeaderProps {
  orgName: string
}

export function DashboardHeader({ orgName }: DashboardHeaderProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Collections Overview</h1>
        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
          {orgName}
        </span>
      </div>
      <p className="text-sm text-slate-500">
        Real-time rent collection tracking, overdue invoice counts, and multi-month revenue analytics.
      </p>
    </div>
  )
}

