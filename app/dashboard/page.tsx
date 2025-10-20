import { DashboardClient } from './dashboard-client';
import { getTeamForUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { eventData, clients, alerts } from '@/lib/db/schema';
import { eq, and, gte, sql } from 'drizzle-orm';

export default async function DashboardPage() {
  const team = await getTeamForUser();
  
  if (!team) {
    return <div className="p-8">No team found</div>;
  }

  // Get active integrations
  const activeIntegrations = await db
    .select()
    .from(clients)
    .where(
      and(
        eq(clients.teamId, team.id),
        eq(clients.isActive, true)
      )
    );

  // Get event data for the last 90 days (to support all time range filters)
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  // Get client IDs for this team
  const clientIds = activeIntegrations.map(c => c.id);

  const rawIntegrationData = clientIds.length > 0 ? await db
    .select({
      integrationName: eventData.integrationName,
      timestamp: sql<string>`DATE_TRUNC('day', ${eventData.timestamp})`,
      totalCount: sql<number>`SUM(${eventData.count})`,
    })
    .from(eventData)
    .where(
      and(
        sql`${eventData.clientId} IN ${sql.raw(`(${clientIds.map(id => `'${id}'`).join(',')})`)}`,
        gte(eventData.timestamp, ninetyDaysAgo)
      )
    )
    .groupBy(eventData.integrationName, sql`DATE_TRUNC('day', ${eventData.timestamp})`)
    .orderBy(sql`DATE_TRUNC('day', ${eventData.timestamp})`)
  : [];

  // Filter out null integration names
  const integrationData = rawIntegrationData.filter(d => d.integrationName !== null) as Array<{
    integrationName: string;
    timestamp: string;
    totalCount: number;
  }>;

  console.log('Active integrations:', activeIntegrations.length);
  console.log('Integration data rows:', integrationData.length);
  console.log('Sample data:', integrationData.slice(0, 3));

  // Get recent alerts (last 90 days to support all time ranges)
  const recentAlerts = await db
    .select({
      id: alerts.id,
      severity: alerts.severity,
      createdAt: alerts.createdAt,
      integrationName: clients.integrationName,
      isResolved: alerts.isResolved,
    })
    .from(alerts)
    .innerJoin(clients, eq(alerts.clientId, clients.id))
    .where(
      and(
        eq(clients.teamId, team.id),
        gte(alerts.createdAt, ninetyDaysAgo)
      )
    )
    .orderBy(alerts.createdAt);

  // Calculate platform stats for scorecards
  const platformStats = await Promise.all(
    activeIntegrations.map(async integration => {
      // Get last sync time (most recent event timestamp from event_data table)
      const lastEvent = await db
        .select({
          timestamp: eventData.timestamp,
        })
        .from(eventData)
        .where(eq(eventData.clientId, integration.id))
        .orderBy(sql`${eventData.timestamp} DESC`)
        .limit(1);

      const lastSyncTime = lastEvent.length > 0 ? lastEvent[0].timestamp : null;

      // Count active alerts for this integration
      const activeAlerts = recentAlerts.filter(
        a => a.integrationName === integration.integrationName && !a.isResolved
      ).length;

      return {
        platform: integration.integrationName,
        lastSyncTime,
        activeAlerts,
        detailsUrl: `/dashboard/integrations/${integration.integrationName.toLowerCase()}`,
      };
    })
  );

  return (
    <DashboardClient
      integrationData={integrationData}
      activeIntegrations={activeIntegrations.map(c => c.integrationName)}
      recentAlerts={recentAlerts}
      platformStats={platformStats}
    />
  );
}