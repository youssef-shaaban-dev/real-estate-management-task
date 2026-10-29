import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatRinggit } from '@/lib/format-date'
import type { CollectionsChartProps } from '../types'

export function CollectionsChart({
  collections,
  fromMonth,
  toMonth,
  totalCollectedSen,
}: CollectionsChartProps) {
  const maxCollected = Math.max(...collections.map((c) => c.collectedSen), 1)

  return (
    <Card className="gap-4">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle>Collections by Month (MYT)</CardTitle>
          <CardDescription>
            Approved rent & deposit receipts ({fromMonth} to {toMonth})
          </CardDescription>
        </div>
        <Badge variant="secondary" className="font-mono text-xs">
          Total: {formatRinggit(totalCollectedSen)}
        </Badge>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-4 pt-4">
          {collections.map((item) => {
            const heightPercent = Math.round((item.collectedSen / maxCollected) * 100)
            const hasCollections = item.collectedSen > 0

            return (
              <div
                key={item.month}
                className="flex flex-col items-center bg-slate-50/80 p-4 rounded-xl border border-slate-100"
              >
                <div className="w-full h-32 flex items-end justify-center mb-3">
                  <div
                    style={{ height: `${Math.max(heightPercent, 4)}%` }}
                    className={`w-10 rounded-t-lg transition-all duration-500 ${
                      hasCollections ? 'bg-slate-900 shadow-xs' : 'bg-slate-200'
                    }`}
                  />
                </div>
                <span className="text-xs font-mono font-bold text-slate-900">
                  {formatRinggit(item.collectedSen)}
                </span>
                <span className="text-[11px] font-medium text-slate-500 mt-1">{item.month}</span>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
