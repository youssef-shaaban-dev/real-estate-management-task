export interface CollectionItem {
  month: string
  collectedSen: number
}

export interface DashboardMetricsProps {
  overdueCount: number
  total6MonthCollectedSen: number
}

export interface CollectionsChartProps {
  collections: CollectionItem[]
  fromMonth: string
  toMonth: string
  totalCollectedSen: number
}

export interface DashboardViewProps {
  userEmail: string
  role: string
  orgName: string
  overdueCount: number
  total6MonthCollectedSen: number
  collections: CollectionItem[]
  fromMonth: string
  toMonth: string
}
