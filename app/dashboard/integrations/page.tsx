import { IntegrationCard } from '@/components/integration-card';
import { IntegrationsSearch } from '@/components/integrations-search';
import { getTeamForUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { clients } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { INTEGRATIONS } from '@/lib/integrations';

const integrations = Object.values(INTEGRATIONS);

export default async function IntegrationsPage() {
  const team = await getTeamForUser();
  const connectedIntegrations = new Set<string>();

  if (team) {
    const teamClients = await db
      .select()
      .from(clients)
      .where(
        and(
          eq(clients.teamId, team.id),
          eq(clients.isActive, true)
        )
      );
    
    teamClients.forEach(client => {
      connectedIntegrations.add(client.integrationName);
    });
  }

  // Sort: connected first, then alphabetically
  const sortedIntegrations = [...integrations].sort((a, b) => {
    const aConnected = connectedIntegrations.has(a.id);
    const bConnected = connectedIntegrations.has(b.id);
    
    if (aConnected && !bConnected) return -1;
    if (!aConnected && bConnected) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Integrations</h1>
          <p className="text-muted-foreground mt-2">
            Connect your favorite tools and services to enhance your workflow
          </p>
        </div>

        <IntegrationsSearch 
          integrations={sortedIntegrations}
          connectedIntegrations={connectedIntegrations}
        />
      </div>
    </div>
  );
}
