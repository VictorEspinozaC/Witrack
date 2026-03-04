import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts'
import type { StageTime } from '@/hooks/useDashboardData'

const STAGE_COLORS = [
  'oklch(0.65 0.18 250)',  // blue
  'oklch(0.65 0.15 200)',  // teal
  'oklch(0.65 0.18 145)',  // green
  'oklch(0.7 0.15 80)',    // amber
  'oklch(0.65 0.18 30)',   // orange
  'oklch(0.6 0.2 15)',     // red
]

interface Props {
  data: StageTime[]
}

export function StageTimesChart({ data }: Props) {
  const hasData = data.some(d => d.avgMinutes > 0)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Tiempos por Etapa (min)</CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="flex h-[200px] items-center justify-center">
            <p className="text-sm text-muted-foreground">Sin datos en el periodo</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 5, right: 20, left: 5, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis type="number" tick={{ fontSize: 11 }} className="text-muted-foreground" />
              <YAxis
                type="category"
                dataKey="label"
                width={100}
                tick={{ fontSize: 10 }}
                className="text-muted-foreground"
              />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                formatter={(value: number) => [`${value} min`, 'Promedio']}
              />
              <Bar dataKey="avgMinutes" radius={[0, 4, 4, 0]}>
                {data.map((_, idx) => (
                  <Cell key={idx} fill={STAGE_COLORS[idx % STAGE_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
