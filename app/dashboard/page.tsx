import { DashboardClient } from './dashboard-client';
import { db } from '@/lib/db/drizzle';
import { clients, eventData, alerts } from '@/lib/db/schema';
import { eq, and, gte, sql, desc, inArray } from 'drizzle-orm';
import { getUser, getCurrentTeamId } from '@/lib/db/queries';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const user = await getUser();
  if (!user) {
    redirect('/sign-in');
  }

  const teamId = await getCurrentTeamId();
  if (!teamId) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">No Team Found</h1>
        <p className="text-muted-foreground mt-2">
          You need to be part of a team to view the dashboard.
        </p>
      </div>
    );
  }

  // Get active integrations for this team
  const activeClients = await db
    .select()
    .from(clients)
    .where(and(eq(clients.teamId, teamId), eq(clients.isActive, true)));

  const activeIntegrations = [...new Set(activeClients.map(c => c.integrationName))];
  const clientIds = activeClients.map(c => c.id);

  // Get integration data (last 90 days for time range selector)
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const integrationData = clientIds.length > 0
    ? await db
        .select({
          integrationName: eventData.integrationName,
          timestamp: eventData.timestamp,
          totalCount: sql<number>`SUM(${eventData.count})`,
        })
        .from(eventData)
        .where(
          and(
            inArray(eventData.clientId, clientIds),
            gte(eventData.timestamp, ninetyDaysAgo)
          )
        )
        .groupBy(eventData.integrationName, eventData.timestamp)
        .orderBy(eventData.timestamp)
    : [];

  // Get recent alerts (last 90 days)
  const recentAlerts = clientIds.length > 0
    ? await db
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
            inArray(alerts.clientId, clientIds),
            gte(alerts.createdAt, ninetyDaysAgo)
          )
        )
        .orderBy(desc(alerts.createdAt))
    : [];

  // Get platform stats
  const platformStats = await Promise.all(
    activeIntegrations.map(async (integration) => {
      const integrationClients = activeClients.filter(c => c.integrationName === integration);
      const integrationClientIds = integrationClients.map(c => c.id);

      // Get last sync time
      const lastSync = integrationClientIds.length > 0
        ? await db
            .select({ timestamp: eventData.timestamp })
            .from(eventData)
            .where(inArray(eventData.clientId, integrationClientIds))
            .orderBy(desc(eventData.timestamp))
            .limit(1)
        : [];

      // Count active alerts
      const activeAlertsCount = integrationClientIds.length > 0
        ? await db
            .select({ count: sql<number>`COUNT(*)` })
            .from(alerts)
            .where(
              and(
                inArray(alerts.clientId, integrationClientIds),
                eq(alerts.isResolved, false)
              )
            )
        : [{ count: 0 }];

      return {
        platform: integration,
        lastSyncTime: lastSync[0]?.timestamp || null,
        activeAlerts: Number(activeAlertsCount[0]?.count || 0),
        detailsUrl: `/dashboard/integrations?filter=${integration}`,
      };
    })
  );

  return (
    <DashboardClient
      integrationData={integrationData.map(d => ({
        integrationName: d.integrationName || 'unknown',
        timestamp: d.timestamp.toISOString(),
        totalCount: d.totalCount,
      }))}
      activeIntegrations={activeIntegrations}
      recentAlerts={recentAlerts}
      platformStats={platformStats}
    />
  );
}
