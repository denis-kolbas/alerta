'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';

interface EventDataPoint {
  timestamp: Date;
  count: number;
}

interface AlertEventChartProps {
  eventName: string;
  integrationName: string;
  eventData: EventDataPoint[];
}

export function AlertEventChart({ eventName, integrationName, eventData }: AlertEventChartProps) {
  if (eventData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{eventName}</CardTitle>
          <CardDescription className="capitalize">
            {integrationName} • No data available
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            No event data found for the last 7 days
          </div>
        </CardContent>
      </Card>
    );
  }

  const chartData = eventData.map(point => ({
    timestamp: new Date(point.timestamp).getTime(),
    count: point.count,
    date: format(new Date(point.timestamp), 'MMM d, HH:mm'),
  }));

  const maxCount = Math.max(...chartData.map(d => d.count));
  const avgCount = chartData.reduce((sum, d) => sum + d.count, 0) / chartData.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{eventName}</CardTitle>
        <CardDescription className="capitalize">
          {integrationName} • Last 7 days
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Total Events</p>
            <p className="text-2xl font-bold">
              {chartData.reduce((sum, d) => sum + d.count, 0).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Average</p>
            <p className="text-2xl font-bold">{Math.round(avgCount).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Peak</p>
            <p className="text-2xl font-bold">{maxCount.toLocaleString()}</p>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => value.toLocaleString()}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="rounded-lg border bg-background p-2 shadow-sm">
                      <div className="grid gap-2">
                        <div className="flex flex-col">
                          <span className="text-[0.70rem] uppercase text-muted-foreground">
                            {payload[0].payload.date}
                          </span>
                          <span className="font-bold text-muted-foreground">
                            {payload[0].value?.toLocaleString()} events
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Line
              type="monotone"
              dataKey="count"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
