import { getTeamForUser, getAlerts } from '@/lib/db/queries';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alerts2Client } from '@/components/alerts-2-client';
import { db } from '@/lib/db/drizzle';
import { clients } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { Plug, Plus } from 'lucide-react';
import Link from 'next/link';

export default async function Alerts2Page() {
  const team = await getTeamForUser();
  
  if (!team) {
    return (
      <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
        <div className="max-w-4xl mx-auto space-y-6">
          <h1 className="text-3xl font-bold tracking-tight">Alerts 2</h1>
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

  const alerts = await getAlerts({ teamId: team.id, limit: 1000 });

  // Get unique platforms
  const platforms = [...new Set(activeIntegrations.map(i => i.integrationName))];

  // Show onboarding if no active integrations
  if (activeIntegrations.length === 0) {
    return (
      <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
        <div className="max-w-4xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Alerts 2</h1>
            <p className="text-muted-foreground mt-2">
              Notification-style alert management
            </p>
          </div>

          <Card className="border-dashed">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <Plug className="h-8 w-8 text-muted-foreground" />
              </div>
              <CardTitle>No active integrations</CardTitle>
              <CardDescription>
                You don&apos;t have any active integrations. Let&apos;s connect your first one now to start monitoring your events.
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
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Alerts 2</h1>
          <p className="text-muted-foreground mt-2">
            Notification-style alert management
          </p>
        </div>

        <Alerts2Client alerts={alerts} platforms={platforms} />
      </div>
    </div>
  );
}
