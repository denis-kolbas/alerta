'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { format, subDays } from 'date-fns';
import { getIntegrationColor } from '@/lib/integrations';

interface EventData {
  integrationName: string;
  timestamp: string;
  totalCount: number;
}

interface EventsTimeseriesChartProps {
  integrationData: EventData[];
  activeIntegrations: string[];
  timeRange: '7d' | '30d' | '90d';
}

export function EventsTimeseriesChart({ integrationData, activeIntegrations, timeRange }: EventsTimeseriesChartProps) {
  const { chartData, chartConfig } = useMemo(() => {
    // Determine date range
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    const endDate = new Date();

    // Create array of all dates in range
    const allDates: string[] = [];
    for (let i = 0; i < days; i++) {
      const date = subDays(endDate, days - 1 - i);
      allDates.push(format(date, 'yyyy-MM-dd'));
    }

    // Group by date
    const dataByDate: Record<string, Record<string, number>> = {};
    
    // Initialize all dates with empty data
    allDates.forEach(date => {
      dataByDate[date] = {};
      activeIntegrations.forEach(integration => {
        dataByDate[date][integration] = 0;
      });
    });

    // Fill in actual data
    integrationData.forEach(item => {
      // Parse the timestamp - it comes as a string from DATE_TRUNC
      const itemDate = new Date(item.timestamp);
      const date = format(itemDate, 'yyyy-MM-dd');
      
      // Only include if within our date range
      if (dataByDate[date] !== undefined) {
        dataByDate[date][item.integrationName] = (dataByDate[date][item.integrationName] || 0) + Number(item.totalCount);
      }
    });

    // Convert to chart format
    const chartData = allDates.map(date => ({
      date,
      ...dataByDate[date],
    }));

    // Create chart config - use integration brand colors
    const chartConfig: ChartConfig = activeIntegrations.reduce((acc, integration) => {
      acc[integration] = {
        label: integration.charAt(0).toUpperCase() + integration.slice(1),
        color: getIntegrationColor(integration),
      };
      return acc;
    }, {} as ChartConfig);

    return { chartData, chartConfig };
  }, [integrationData, activeIntegrations, timeRange]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Event Volume</CardTitle>
        <CardDescription>Daily event counts by integration</CardDescription>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        {chartData.length === 0 || activeIntegrations.length === 0 ? (
          <div className="flex h-80 items-center justify-center text-muted-foreground">
            No data available
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-80 w-full">
            <AreaChart data={chartData}>
              <defs>
                {activeIntegrations.map((integration) => (
                  <linearGradient key={integration} id={`fill${integration}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={`var(--color-${integration})`} stopOpacity={0.8} />
                    <stop offset="95%" stopColor={`var(--color-${integration})`} stopOpacity={0.1} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                tickFormatter={(value) => format(new Date(value), 'MMM d')}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value) => value.toLocaleString()}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) => format(new Date(value as string), 'MMM d, yyyy')}
                    indicator="dot"
                  />
                }
              />
              {activeIntegrations.map((integration) => (
                <Area
                  key={integration}
                  dataKey={integration}
                  type="monotone"
                  fill={`url(#fill${integration})`}
                  stroke={`var(--color-${integration})`}
                  strokeWidth={2}
                  stackId="a"
                />
              ))}
              <ChartLegend content={<ChartLegendContent />} />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
