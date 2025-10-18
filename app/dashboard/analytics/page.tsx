import { getEventTimeSeries, getUniqueEventNames, getTeamForUser, getAlerts, getActiveIntegrations } from '@/lib/db/queries';
import { Card, CardContent } from '@/components/ui/card';
import { AnalyticsDashboard } from '@/components/analytics-dashboard';

export default async function AnalyticsPage() {
  const team = await getTeamForUser();
  
  if (!team) {
    return (
      <div className="flex-1 space-y-4 p-8 pt-6">
        <h2 className="text-3xl font-bold tracking-tight">Analytics</h2>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">No team found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const [eventData, availableEvents, alerts, activeIntegrations] = await Promise.all([
    getEventTimeSeries(undefined, undefined, 24 * 7, team.id),
    getUniqueEventNames(undefined, team.id),
    getAlerts({ teamId: team.id, limit: 50 }),
    getActiveIntegrations(team.id)
  ]);

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Analytics</h2>
      </div>

      <AnalyticsDashboard
        eventData={eventData}
        availableEvents={availableEvents}
        availableBrands={[team.name]}
        alerts={alerts}
        activeIntegrations={activeIntegrations}
      />
    </div>
  );
}