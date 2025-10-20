'use client';

import { useState, useMemo } from 'react';
import { EventsTimeseriesChart } from '@/components/events-timeseries-chart';
import { AlertsDailyChart } from '@/components/alerts-daily-chart';
import { AlertsSeverityPie } from '@/components/alerts-severity-pie';
import { AlertsByPlatform } from '@/components/alerts-by-platform';
import { PlatformScorecard } from '@/components/platform-scorecard';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { subDays } from 'date-fns';

type TimeRange = '7d' | '30d' | '90d';

interface DashboardClientProps {
  integrationData: Array<{
    integrationName: string;
    timestamp: string;
    totalCount: number;
  }>;
  activeIntegrations: string[];
  recentAlerts: Array<{
    id: number;
    severity: string;
    createdAt: Date;
    integrationName: string;
    isResolved: boolean;
  }>;
  platformStats: Array<{
    platform: string;
    lastSyncTime: Date | null;
    activeAlerts: number;
    detailsUrl: string;
  }>;
}

export function DashboardClient({ integrationData, activeIntegrations, recentAlerts, platformStats }: DashboardClientProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');

  // Calculate platform scorecard data based on selected time range
  const platformScorecardData = useMemo(() => {
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    const startDate = subDays(new Date(), days);
    const previousStartDate = subDays(startDate, days);

    return platformStats.map(stat => {
      // Calculate event count for current period
      const currentPeriodEvents = integrationData.filter(
        e => e.integrationName === stat.platform && new Date(e.timestamp) >= startDate
      );
      const eventCount = currentPeriodEvents.reduce((sum, e) => sum + Number(e.totalCount), 0);

      // Calculate event count for previous period
      const previousPeriodEvents = integrationData.filter(
        e =>
          e.integrationName === stat.platform &&
          new Date(e.timestamp) >= previousStartDate &&
          new Date(e.timestamp) < startDate
      );
      const previousEventCount = previousPeriodEvents.reduce((sum, e) => sum + Number(e.totalCount), 0);

      // Calculate percent change
      let percentChange: number | null = null;
      if (previousEventCount > 0) {
        percentChange = ((eventCount - previousEventCount) / previousEventCount) * 100;
      } else if (eventCount > 0) {
        percentChange = 100;
      }

      return {
        ...stat,
        eventCount,
        percentChange,
      };
    });
  }, [platformStats, integrationData, timeRange]);

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {activeIntegrations.length} {activeIntegrations.length === 1 ? 'integration' : 'integrations'} connected
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/integrations">
            <Plus className="mr-2 h-4 w-4" />
            Connect New
          </Link>
        </Button>
      </div>

      {/* Platform Scorecards */}
      {platformScorecardData.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {platformScorecardData.map(platform => (
            <PlatformScorecard
              key={platform.platform}
              platform={platform.platform}
              lastSyncTime={platform.lastSyncTime}
              eventCount={platform.eventCount}
              percentChange={platform.percentChange}
              activeAlerts={platform.activeAlerts}
              detailsUrl={platform.detailsUrl}
            />
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Analytics</h2>
        <div className="flex items-center border rounded-md bg-background">
          <Button
            variant={timeRange === '7d' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setTimeRange('7d')}
            className="rounded-r-none"
          >
            7D
          </Button>
          <Button
            variant={timeRange === '30d' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setTimeRange('30d')}
            className="rounded-none"
          >
            30D
          </Button>
          <Button
            variant={timeRange === '90d' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setTimeRange('90d')}
            className="rounded-l-none"
          >
            90D
          </Button>
        </div>
      </div>
      
      <EventsTimeseriesChart 
        integrationData={integrationData}
        activeIntegrations={activeIntegrations}
        timeRange={timeRange}
      />

      <AlertsDailyChart alerts={recentAlerts} timeRange={timeRange} />

      <div className="grid gap-6 md:grid-cols-2">
        <AlertsSeverityPie alerts={recentAlerts} timeRange={timeRange} />
        <AlertsByPlatform alerts={recentAlerts} />
      </div>
    </div>
  );
}
