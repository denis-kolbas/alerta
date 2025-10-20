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
        <h1 className="text-3xl font-bold tracking-tight">Alerts</h1>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">No team found</p>
          </CardContent>
        </Card>
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

  const alerts = await getAlerts({ teamId: team.id, limit: 1000 });

  // Get unique platforms
  const platforms = [...new Set(activeIntegrations.map(i => i.integrationName))];

  // Show onboarding if no active integrations
  if (activeIntegrations.length === 0) {
    return (
      <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Alerts</h1>
          <p className="text-muted-foreground mt-2">
            This is where pesky problems show up.
          </p>
        </div>

        <Card className="border-dashed">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Plug className="h-8 w-8 text-muted-foreground" />
            </div>
            <CardTitle>No active integrations</CardTitle>
            <CardDescription>
              You don't have any active integrations. Let's connect your first one now to start monitoring your events.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center pb-8">
            <Button asChild className="bg-[#ff4f00] hover:bg-[#e64700] text-white">
              <Link href="/dashboard/integrations">
                <Plus className="mr-1 h-4 w-4" />
                Connect
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Alerts</h1>
        <p className="text-muted-foreground mt-2">
          Monitor and manage anomalies across your integrations
        </p>
      </div>

      <AlertsPageClient alerts={alerts} platforms={platforms} />
    </div>
  );
}