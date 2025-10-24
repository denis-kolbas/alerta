'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useMemo } from 'react';

interface IntegrationData {
  integrationName: string;
  timestamp: string;
  totalCount: number;
}

interface DailyEventsChartProps {
  integrationData: IntegrationData[];
  activeIntegrations: string[];
}

export function DailyEventsChart({ integrationData, activeIntegrations }: DailyEventsChartProps) {
  const chartData = useMemo(() => {
    // Group by date
    const grouped: Record<string, Record<string, unknown>> = {};
    
    integrationData.forEach(item => {
      const date = new Date(item.timestamp);
      const dateKey = date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC'
      });
      
      if (!grouped[dateKey]) {
        grouped[dateKey] = { date: dateKey, timestamp: item.timestamp };
      }
      
      grouped[dateKey][item.integrationName] = Number(item.totalCount);
    });
    
    return Object.values(grouped).sort((a, b) => 
      new Date((a as { timestamp: string }).timestamp).getTime() - new Date((b as { timestamp: string }).timestamp).getTime()
    );
  }, [integrationData]);

  const chartConfig: ChartConfig = useMemo(() => {
    const config: ChartConfig = {};
    
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
        <CardTitle>Daily Event Trends</CardTitle>
        <CardDescription>
          Event counts by integration over time (last 7 days)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="flex h-80 items-center justify-center text-muted-foreground">
            No data available
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[300px]">
            <BarChart data={chartData}>
              <CartesianGrid vertical={false} />
              <XAxis 
                dataKey="date" 
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value) => value.toLocaleString()}
              />
              <ChartTooltip 
                content={
                  <ChartTooltipContent 
                    formatter={(value, name) => (
                      <div className="flex items-center justify-between gap-4 w-full">
                        <span className="text-muted-foreground capitalize">{name}</span>
                        <span className="font-mono font-medium">{Number(value).toLocaleString()}</span>
                      </div>
                    )}
                  />
                }
              />
              {activeIntegrations.map((integration, index) => (
                <Bar
                  key={integration}
                  dataKey={integration}
                  fill={`var(--chart-${(index % 5) + 1})`}
                  stackId="1"
                  radius={[4, 4, 0, 0]}
                />
              ))}
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
