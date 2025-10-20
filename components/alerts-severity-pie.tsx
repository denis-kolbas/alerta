'use client';

import { useMemo } from 'react';
import { Pie, PieChart } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartConfig, ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

interface Alert {
  id: number;
  severity: string;
  createdAt: Date;
}

interface AlertsSeverityPieProps {
  alerts: Alert[];
  timeRange: '7d' | '30d' | '90d';
}

const chartConfig = {
  alerts: {
    label: 'Alerts',
  },
  critical: {
    label: 'Critical',
    color: 'hsl(0, 84%, 60%)',
  },
  warning: {
    label: 'Warning',
    color: 'hsl(45, 93%, 47%)',
  },
} satisfies ChartConfig;

export function AlertsSeverityPie({ alerts, timeRange }: AlertsSeverityPieProps) {
  const chartData = useMemo(() => {
    const counts = {
      critical: 0,
      warning: 0,
    };

    alerts.forEach(alert => {
      if (alert.severity === 'critical') {
        counts.critical++;
      } else if (alert.severity === 'warning') {
        counts.warning++;
      }
    });

    return [
      {
        severity: 'critical',
        count: counts.critical,
        fill: 'hsl(0, 84%, 60%)',
      },
      {
        severity: 'warning',
        count: counts.warning,
        fill: 'hsl(45, 93%, 47%)',
      },
    ].filter(item => item.count > 0);
  }, [alerts]);

  const total = chartData.reduce((sum, item) => sum + item.count, 0);

  return (
    <Card className="flex flex-col">
      <CardHeader className="items-center pb-0">
        <CardTitle>Alerts by Severity</CardTitle>
        <CardDescription>
          {total} {total === 1 ? 'alert' : 'alerts'} in selected period
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        {total === 0 ? (
          <div className="flex h-[300px] items-center justify-center text-muted-foreground">
            No alerts in the selected period
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[300px]">
            <PieChart>
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    hideLabel
                    formatter={(value, name) => (
                      <div className="flex items-center justify-between gap-4 w-full">
                        <span className="text-muted-foreground capitalize">{name}</span>
                        <span className="font-mono font-medium">{value}</span>
                      </div>
                    )}
                  />
                }
              />
              <Pie data={chartData} dataKey="count" nameKey="severity" />
              <ChartLegend
                content={<ChartLegendContent nameKey="severity" />}
                className="-translate-y-2 flex-wrap gap-2 *:basis-1/4 *:justify-center"
              />
            </PieChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
