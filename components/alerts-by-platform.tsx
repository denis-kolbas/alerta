'use client';

import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartConfig, ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

interface Alert {
  id: number;
  severity: string;
  createdAt: Date;
  integrationName: string;
}

interface AlertsByPlatformProps {
  alerts: Alert[];
}

const chartConfig = {
  critical: {
    label: 'Critical',
    color: 'hsl(0, 84%, 60%)',
  },
  warning: {
    label: 'Warning',
    color: 'hsl(45, 93%, 47%)',
  },
} satisfies ChartConfig;

export function AlertsByPlatform({ alerts }: AlertsByPlatformProps) {
  const chartData = useMemo(() => {
    // Group alerts by platform and severity
    const platformCounts: Record<string, { critical: number; warning: number }> = {};

    alerts.forEach(alert => {
      const platform = alert.integrationName;
      if (!platformCounts[platform]) {
        platformCounts[platform] = { critical: 0, warning: 0 };
      }

      if (alert.severity === 'critical') {
        platformCounts[platform].critical++;
      } else if (alert.severity === 'warning') {
        platformCounts[platform].warning++;
      }
    });

    // Convert to chart format
    return Object.entries(platformCounts).map(([platform, counts]) => ({
      platform: platform.charAt(0).toUpperCase() + platform.slice(1),
      critical: counts.critical,
      warning: counts.warning,
    }));
  }, [alerts]);

  const total = alerts.length;

  return (
    <Card className="flex flex-col">
      <CardHeader className="items-center pb-0">
        <CardTitle>Alerts by Platform</CardTitle>
        <CardDescription>
          {total} {total === 1 ? 'alert' : 'alerts'} across {chartData.length} {chartData.length === 1 ? 'platform' : 'platforms'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        {chartData.length === 0 ? (
          <div className="flex h-[300px] items-center justify-center text-muted-foreground">
            No alerts in the selected period
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 10 }}>
              <CartesianGrid horizontal={false} />
              <YAxis
                dataKey="platform"
                type="category"
                tickLine={false}
                axisLine={false}
                tickMargin={10}
                width={80}
              />
              <XAxis
                type="number"
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <ChartTooltip content={<ChartTooltipContent hideLabel />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar
                dataKey="critical"
                stackId="a"
                fill="hsl(0, 84%, 60%)"
                radius={[0, 4, 4, 0]}
              />
              <Bar
                dataKey="warning"
                stackId="a"
                fill="hsl(45, 93%, 47%)"
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
