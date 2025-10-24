'use client';

import { useState, useMemo } from 'react';
import { EventsTimeseriesChart } from '@/components/events-timeseries-chart';
import { AlertsDailyChart } from '@/components/alerts-daily-chart';
import { AlertsSeverityPie } from '@/components/alerts-severity-pie';
import { AlertsByPlatform } from '@/components/alerts-by-platform';
import { PlatformScorecard } from '@/components/platform-scorecard';
import { NotificationBanner } from '@/components/notification-banner';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Plus, CheckCircle2, XCircle, AlertCircle, Plug } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { subDays } from 'date-fns';
import { useAlertCount } from '@/lib/contexts/alert-context';

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
    uniqueEvents: number;
    sparklineData: Array<{ date: string; total: number }>;
    detailsUrl: string;
  }>;
}

export function DashboardClient({ integrationData, activeIntegrations, recentAlerts, platformStats }: DashboardClientProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const { activeAlertCount } = useAlertCount();

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

      // Count unique days with data in previous period to check data sufficiency
      const previousPeriodDays = new Set(
        previousPeriodEvents.map(e => new Date(e.timestamp).toDateString())
      ).size;
      const dataCompleteness = previousPeriodDays / days;

      // Calculate percent change only if we have sufficient data (at least 50% of days)
      let percentChange: number | null = null;
      if (dataCompleteness >= 0.5 && previousEventCount > 0) {
        percentChange = ((eventCount - previousEventCount) / previousEventCount) * 100;
      }

      // Filter sparkline data for current time range
      const filteredSparklineData = stat.sparklineData.filter(
        d => new Date(d.date) >= startDate
      );

      return {
        ...stat,
        eventCount,
        percentChange,
        uniqueEvents: stat.uniqueEvents,
        sparklineData: filteredSparklineData,
        timeRange,
      };
    });
  }, [platformStats, integrationData, timeRange]);

  if (activeIntegrations.length === 0) {
    return (
      <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
        <div className="max-w-6xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
            <p className="text-muted-foreground mt-2">
              Get started by connecting your first integration
            </p>
          </div>

          <Card className="border-border bg-card shadow-sm">
            <CardContent className="py-12 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Plug className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No active integrations</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                You don&apos;t have any active integrations. Let&apos;s connect your first one now to start monitoring your events.
              </p>
              <Button asChild>
                <Link href="/dashboard/integrations">
                  <Plus className="mr-1 h-4 w-4" />
                  Connect Integration
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto space-y-6">
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
                uniqueEvents={platform.uniqueEvents}
                sparklineData={platform.sparklineData}
                timeRange={timeRange}
                detailsUrl={platform.detailsUrl}
              />
            ))}
          </div>
        )}

        {/* Alert Status Banner */}
        {activeAlertCount === 0 ? (
          <NotificationBanner
            icon={CheckCircle2}
            title="All clear"
            description="No active alerts. Everything is working as intended."
            variant="neutral"
          />
        ) : (
          <NotificationBanner
            icon={activeAlertCount > 0 && recentAlerts.some(a => !a.isResolved && a.severity === 'critical') ? XCircle : AlertCircle}
            title={activeAlertCount > 0 && recentAlerts.some(a => !a.isResolved && a.severity === 'critical') 
              ? `${activeAlertCount} critical ${activeAlertCount === 1 ? 'alert' : 'alerts'} require attention`
              : `${activeAlertCount} active ${activeAlertCount === 1 ? 'alert' : 'alerts'}`
            }
            description={activeAlertCount > 0 && recentAlerts.some(a => !a.isResolved && a.severity === 'critical')
              ? "Critical issues detected that need immediate attention."
              : "Review and resolve active alerts to keep your systems healthy."
            }
            variant="neutral"
            action={
              <Button asChild variant="outline" size="sm">
                <Link href="/dashboard/alerts-2">
                  View Alerts
                </Link>
              </Button>
            }
          />
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
    </div>
  );
}
