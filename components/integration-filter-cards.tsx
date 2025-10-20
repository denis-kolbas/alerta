'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { IntegrationIcon } from '@/lib/integrations';

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

// Emoji fallbacks until images are added
const integrationEmojis: Record<string, string> = {
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
        const logo = integrationEmojis[integration.name] || '📦';
        const colorClass = integrationColors[integration.name] || 'from-gray-500/10 to-gray-500/10 border-gray-200 dark:border-gray-800';

        return (
          <Card
            key={integration.name}
            className={`cursor-pointer transition-all relative overflow-hidden px-5 py-3.5 gap-0 ${
              isSelected
                ? `bg-primary/5 border-primary/50 shadow-sm`
                : 'hover:bg-accent/50 hover:border-primary/20'
            }`}
            onClick={() => onToggle(integration.name)}
          >
            <CardContent className="p-0 flex items-center gap-3.5">
              <div className="w-9 h-9 flex items-center justify-center flex-shrink-0">
                <IntegrationIcon integrationId={integration.name} size="default" />
              </div>
              
              <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium capitalize text-sm">
                    {integration.name}
                  </span>
                  {integration.activeAlertCount > 0 && (
                    <Badge variant="destructive" className="h-4 text-[10px] px-1.5 font-normal">
                      {integration.activeAlertCount}
                    </Badge>
                  )}
                </div>
                
                <div className="flex items-baseline gap-1 text-muted-foreground">
                  <span className="text-sm tabular-nums">
                    {integration.eventCount.toLocaleString()}
                  </span>
                  <span className="text-sm">
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
