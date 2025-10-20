'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, LabelList } from 'recharts';
import { useMemo } from 'react';

interface IntegrationData {
  integrationName: string;
  timestamp: string;
  totalCount: number;
}

interface IntegrationOverviewProps {
  integrationData: IntegrationData[];
  activeIntegrations: string[];
}

export function IntegrationOverview({ integrationData, activeIntegrations }: IntegrationOverviewProps) {
  const chartData = useMemo(() => {
    // Aggregate total counts per integration
    const totals: Record<string, number> = {};
    
    integrationData.forEach(item => {
      if (!totals[item.integrationName]) {
        totals[item.integrationName] = 0;
      }
      // Ensure it's a number
      totals[item.integrationName] += Number(item.totalCount);
    });
    
    // Convert to chart format with individual colors
    return Object.entries(totals).map(([integration, count], index) => ({
      integration,
      count: Number(count),
      fill: `var(--chart-${(index % 5) + 1})`,
    }));
  }, [integrationData]);

  const chartConfig: ChartConfig = useMemo(() => {
    const config: ChartConfig = {
      count: {
        label: 'Events',
      },
    };
    
    activeIntegrations.forEach((integration, index) => {
      config[integration] = {
        label: integration.charAt(0).toUpperCase() + integration.slice(1),
        color: `var(--chart-${(index % 5) + 1})`,
      };
    });
    
    return config;
  }, [activeIntegrations]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Integration Activity</CardTitle>
        <CardDescription>
          Total event counts by integration (last 7 days)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="flex h-80 items-center justify-center text-muted-foreground">
            No data available
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-auto min-h-[150px]">
            <BarChart
              accessibilityLayer
              data={chartData}
              layout="vertical"
              margin={{ left: 0, top: 5, bottom: 5, right: 60 }}
              barCategoryGap="20%"
            >
              <YAxis
                dataKey="integration"
                type="category"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                tickFormatter={(value) =>
                  chartConfig[value as keyof typeof chartConfig]?.label || value
                }
              />
              <XAxis dataKey="count" type="number" hide />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent 
                    hideLabel 
                    formatter={(value, name) => (
                      <div className="flex items-center justify-between gap-4 w-full">
                        <span className="text-muted-foreground capitalize">{name}</span>
                        <span className="font-mono font-medium">{Number(value).toLocaleString()}</span>
                      </div>
                    )}
                  />
                }
              />
              <Bar dataKey="count" layout="vertical" radius={5} barSize={40}>
                <LabelList 
                  dataKey="count" 
                  position="right" 
                  formatter={(value: number) => value.toLocaleString()}
                  className="fill-foreground text-xs"
                />
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
