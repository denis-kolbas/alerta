import { getTeamForUser, getAlerts } from '@/lib/db/queries';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertsPageClient } from '@/components/alerts-page-client';
import { db } from '@/lib/db/drizzle';
import { clients } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { Plug, Plus } from 'lucide-react';
import Link from 'next/link';

export default async function AnalyticsPage() {
  const team = await getTeamForUser();
  
  if (!team) {
    return (
      <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
        <div className="max-w-6xl mx-auto space-y-6">
          <h1 className="text-3xl font-bold tracking-tight">Alerts</h1>
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground">No team found</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Check for active integrations
  const activeIntegrations = await db
    .select()
    .from(clients)
    .where(
      and(
        eq(clients.teamId, team.id),
        eq(clients.isActive, true)
      )
    );

  const alertsData = await getAlerts({ teamId: team.id, limit: 1000 });
  
  // Cast metadata to proper type and exclude clientId
  const alerts = alertsData.map(({ clientId, ...alert }) => ({
    id: alert.id,
    brandName: alert.brandName,
    eventName: alert.eventName,
    ruleType: alert.ruleType,
    severity: alert.severity,
    message: alert.message,
    metadata: (alert.metadata || {}) as Record<string, unknown>,
    createdAt: alert.createdAt,
    resolvedAt: alert.resolvedAt,
    isResolved: alert.isResolved,
    status: alert.status as 'active' | 'resolved' | 'dismissed' | undefined,
    integrationName: alert.integrationName
  }));

  // Get unique platforms
  const platforms = [...new Set(activeIntegrations.map(i => i.integrationName))];

  // Show onboarding if no active integrations
  if (activeIntegrations.length === 0) {
    return (
      <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
        <div className="max-w-6xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Alerts</h1>
            <p className="text-muted-foreground mt-2">
              This is where pesky problems show up.
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
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Alerts</h1>
          <p className="text-muted-foreground mt-2">
            Monitor and manage anomalies across your integrations
          </p>
        </div>

        <AlertsPageClient alerts={alerts} platforms={platforms} />
      </div>
    </div>
  );
}