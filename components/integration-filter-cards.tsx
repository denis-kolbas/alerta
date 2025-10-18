'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface IntegrationStats {
  name: string;
  eventCount: number;
  isActive: boolean;
  activeAlertCount: number;
}

interface IntegrationFilterCardsProps {
  integrations: IntegrationStats[];
  selectedIntegrations: string[];
  onToggle: (integration: string) => void;
}

const integrationLogos: Record<string, string> = {
  braze: '🔥',
  klaviyo: '✉️',
  mixpanel: '📊',
  segment: '🎯',
};

const integrationColors: Record<string, string> = {
  braze: 'from-orange-500/10 to-red-500/10 border-orange-200 dark:border-orange-800',
  klaviyo: 'from-blue-500/10 to-indigo-500/10 border-blue-200 dark:border-blue-800',
  mixpanel: 'from-purple-500/10 to-pink-500/10 border-purple-200 dark:border-purple-800',
  segment: 'from-green-500/10 to-emerald-500/10 border-green-200 dark:border-green-800',
};

export function IntegrationFilterCards({
  integrations,
  selectedIntegrations,
  onToggle,
}: IntegrationFilterCardsProps) {
  if (integrations.length === 0) {
    return null;
  }

  return (
    <div className="flex gap-3 flex-wrap">
      {integrations.map((integration) => {
        const isSelected = selectedIntegrations.includes(integration.name);
        const logo = integrationLogos[integration.name] || '📦';
        const colorClass = integrationColors[integration.name] || 'from-gray-500/10 to-gray-500/10 border-gray-200 dark:border-gray-800';

        return (
          <Card
            key={integration.name}
            className={`cursor-pointer transition-all hover:shadow-sm relative overflow-hidden ${
              isSelected
                ? `ring-2 ring-primary bg-gradient-to-br ${colorClass}`
                : 'hover:border-primary/50'
            }`}
            onClick={() => onToggle(integration.name)}
          >
            <CardContent className="p-3 flex items-center gap-3">
              <div className="text-2xl">{logo}</div>
              
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold capitalize text-sm">
                    {integration.name}
                  </span>
                  {integration.isActive && (
                    <Badge variant="secondary" className="h-4 text-[10px] px-1.5">
                      Active
                    </Badge>
                  )}
                  {integration.activeAlertCount > 0 && (
                    <Badge variant="destructive" className="h-4 text-[10px] px-1.5">
                      {integration.activeAlertCount}
                    </Badge>
                  )}
                </div>
                
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-bold">
                    {integration.eventCount.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    events
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
