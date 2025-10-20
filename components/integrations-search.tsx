'use client';

import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { IntegrationCard } from '@/components/integration-card';
import { Search } from 'lucide-react';

import { IntegrationConfig } from '@/lib/integrations';

type Integration = IntegrationConfig;

interface IntegrationsSearchProps {
  integrations: Integration[];
  connectedIntegrations: Set<string>;
}

export function IntegrationsSearch({ integrations, connectedIntegrations }: IntegrationsSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredIntegrations = useMemo(() => {
    if (!searchTerm) return integrations;

    const term = searchTerm.toLowerCase();
    return integrations.filter(integration =>
      integration.name.toLowerCase().includes(term) ||
      integration.description.toLowerCase().includes(term) ||
      integration.category.toLowerCase().includes(term)
    );
  }, [integrations, searchTerm]);

  return (
    <div className="space-y-6">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search integrations..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 bg-background"
        />
      </div>

      {filteredIntegrations.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No integrations found matching "{searchTerm}"</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredIntegrations.map((integration) => (
            <IntegrationCard
              key={integration.id}
              integration={integration}
              isConnected={connectedIntegrations.has(integration.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
