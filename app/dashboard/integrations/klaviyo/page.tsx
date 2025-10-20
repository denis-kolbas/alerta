import { KlaviyoIntegrationForm } from '@/components/klaviyo-integration-form-v2';
import { KlaviyoConnectionStatus } from '@/components/klaviyo-connection-status';
import { IntegrationIcon } from '@/lib/integrations';
import { getTeamForUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { clients } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default async function KlaviyoIntegrationPage() {
  const team = await getTeamForUser();
  let existingIntegration = null;

  if (team) {
    const klaviyoClients = await db
      .select()
      .from(clients)
      .where(
        and(
          eq(clients.teamId, team.id),
          eq(clients.integrationName, 'klaviyo'),
          eq(clients.isActive, true)
        )
      )
      .limit(1);
    
    if (klaviyoClients.length > 0) {
      existingIntegration = {
        hasApiKey: !!klaviyoClients[0].brazeApiKey,
        isActive: klaviyoClients[0].isActive ?? false,
        blacklistedEvents: (klaviyoClients[0].blacklistedEvents as string[]) || [],
      };
    }
  }

  const isConnected = existingIntegration?.isActive && existingIntegration?.hasApiKey;

  return (
    <div className="flex-1 space-y-8 p-8 pt-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <Link 
          href="/dashboard/integrations" 
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Integrations
        </Link>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0">
              <IntegrationIcon integrationId="klaviyo" size="large" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-3xl font-bold tracking-tight">
                {isConnected ? 'Klaviyo' : 'Connect Klaviyo'}
              </h2>
              <p className="text-muted-foreground mt-1">
                {isConnected 
                  ? 'Manage your Klaviyo integration settings' 
                  : 'Connect your Klaviyo account to sync email and SMS engagement data'}
              </p>
            </div>
          </div>
          {isConnected && <KlaviyoConnectionStatus />}
        </div>
      </div>

      <div className="max-w-2xl mx-auto">
        <KlaviyoIntegrationForm existingData={existingIntegration} />
      </div>
    </div>
  );
}
