import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { IntegrationCard } from '@/components/integration-card';
import { getTeamForUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { clients } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

const integrations = [
  {
    id: 'braze',
    name: 'Braze',
    description: 'Customer engagement platform for personalized messaging across channels',
    logo: '🔥',
    category: 'Marketing Automation',
    href: '/dashboard/integrations/braze',
  },
  {
    id: 'mixpanel',
    name: 'Mixpanel',
    description: 'Product analytics platform to understand user behavior and drive engagement',
    logo: '📊',
    category: 'Analytics',
    href: null,
  },
  {
    id: 'klaviyo',
    name: 'Klaviyo',
    description: 'Email and SMS marketing platform for ecommerce businesses',
    logo: '✉️',
    category: 'Email Marketing',
    href: '/dashboard/integrations/klaviyo',
  },
];

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

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Integrations</h1>
        <p className="text-muted-foreground mt-2">
          Connect your favorite tools and services to enhance your workflow
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {integrations.map((integration) => (
          <IntegrationCard
            key={integration.id}
            integration={integration}
            isConnected={connectedIntegrations.has(integration.id)}
          />
        ))}
      </div>
    </div>
  );
}
