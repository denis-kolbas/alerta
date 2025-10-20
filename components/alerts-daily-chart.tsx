'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { format } from 'date-fns';

interface Alert {
  id: number;
  severity: string;
  createdAt: Date;
}

interface AlertsDailyChartProps {
  alerts: Alert[];
  timeRange: '7d' | '30d' | '90d';
}

const chartConfig = {
  critical: {
    label: 'Critical',
    color: 'hsl(0, 84%, 60%)', // red
  },
  warning: {
    label: 'Warning',
    color: 'hsl(45, 93%, 47%)', // yellow
  },
} satisfies ChartConfig;

export function AlertsDailyChart({ alerts, timeRange }: AlertsDailyChartProps) {
  const chartData = useMemo(() => {
    // Create array based on time range
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    const endDate = new Date();
    const allDates: string[] = [];
    
    for (let i = 0; i < days; i++) {
      const date = new Date(endDate);
      date.setDate(date.getDate() - (days - 1 - i));
      allDates.push(format(date, 'yyyy-MM-dd'));
    }

    // Initialize all dates with zero counts
    const dataByDate: Record<string, { critical: number; warning: number }> = {};
    allDates.forEach(date => {
      dataByDate[date] = { critical: 0, warning: 0 };
    });
    
    // Fill in actual alert data
    alerts.forEach(alert => {
      const date = format(new Date(alert.createdAt), 'yyyy-MM-dd');
      if (dataByDate[date]) {
        if (alert.severity === 'critical') {
          dataByDate[date].critical++;
        } else if (alert.severity === 'warning') {
          dataByDate[date].warning++;
        }
      }
    });

    // Convert to chart format
    return allDates.map(date => ({
      date,
      ...dataByDate[date],
    }));
  }, [alerts, timeRange]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Alert Activity</CardTitle>
        <CardDescription>Daily alert counts by severity</CardDescription>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="flex h-80 items-center justify-center text-muted-foreground">
            No alerts in the selected period
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-52 w-full">
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => format(new Date(value), 'MMM d')}
                  className="text-xs"
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  className="text-xs"
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      labelFormatter={(value) => format(new Date(value as string), 'MMM d, yyyy')}
                      formatter={(value, name) => (
                        <div className="flex items-center justify-between gap-4 w-full">
                          <span className="text-muted-foreground capitalize">{name}</span>
                          <span className="font-mono font-medium">{value}</span>
                        </div>
                      )}
                    />
                  }
                />
                <Bar
                  dataKey="critical"
                  stackId="alerts"
                  fill="hsl(0, 84%, 60%)"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="warning"
                  stackId="alerts"
                  fill="hsl(45, 93%, 47%)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
