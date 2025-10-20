'use client';

import { ConnectionStatusDropdown } from '@/components/connection-status-dropdown';
import { disconnectBrazeIntegration } from '@/app/dashboard/integrations/braze/actions';

export function BrazeConnectionStatus() {
  return (
    <ConnectionStatusDropdown 
      integrationName="Braze"
      onDisconnect={disconnectBrazeIntegration}
    />
  );
}
