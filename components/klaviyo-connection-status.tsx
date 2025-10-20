'use client';

import { ConnectionStatusDropdown } from '@/components/connection-status-dropdown';
import { disconnectKlaviyoIntegration } from '@/app/dashboard/integrations/klaviyo/actions';

export function KlaviyoConnectionStatus() {
  return (
    <ConnectionStatusDropdown 
      integrationName="Klaviyo"
      onDisconnect={disconnectKlaviyoIntegration}
    />
  );
}
