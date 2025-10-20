
import { BrazeIntegrationForm } from '@/components/braze-integration-form-v2';
import { BrazeConnectionStatus } from '@/components/braze-connection-status';
import { IntegrationIcon } from '@/lib/integrations';
import { getTeamForUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { clients } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default async function BrazeIntegrationPage() {
  const team = await getTeamForUser();
  let existingIntegration = null;

  if (team) {
    const brazeClients = await db
      .select()
      .from(clients)
      .where(
        and(
          eq(clients.teamId, team.id),
          eq(clients.integrationName, 'braze'),
          eq(clients.isActive, true)
        )
      )
      .limit(1);
    
    if (brazeClients.length > 0) {
      existingIntegration = {
        brazeInstance: brazeClients[0].brazeInstanceUrl || '',
        hasApiKey: !!brazeClients[0].brazeApiKey,
        isActive: brazeClients[0].isActive ?? false,
        blacklistedEvents: (brazeClients[0].blacklistedEvents as string[]) || [],
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
              <IntegrationIcon integrationId="braze" size="large" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-3xl font-bold tracking-tight">
                {isConnected ? 'Braze' : 'Connect Braze'}
              </h2>
              <p className="text-muted-foreground mt-1">
                {isConnected 
                  ? 'Manage your Braze integration settings' 
                  : 'Connect your Braze account to sync customer engagement data'}
              </p>
            </div>
          </div>
          {isConnected && <BrazeConnectionStatus />}
        </div>
      </div>

      <div className="max-w-2xl mx-auto">
        <BrazeIntegrationForm existingData={existingIntegration} />
      </div>
    </div>
  );
}
