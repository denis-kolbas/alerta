'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardAction } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

import { IntegrationConfig, IntegrationIcon } from '@/lib/integrations';

type Integration = IntegrationConfig;

interface IntegrationCardProps {
  integration: Integration;
  isConnected: boolean;
}

export function IntegrationCard({ integration, isConnected }: IntegrationCardProps) {

  return (
    <Card className="flex flex-col transition-colors duration-200 hover:border-primary/40">
        <CardHeader>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-16 h-16 flex items-center justify-center flex-shrink-0">
              <IntegrationIcon integrationId={integration.id} size="large" />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="truncate">{integration.name}</CardTitle>
              <Badge variant="secondary" className="mt-1 whitespace-nowrap">
                {integration.category}
              </Badge>
            </div>
          </div>
          {isConnected && (
            <CardAction>
              <Badge variant="default" className="bg-green-600 whitespace-nowrap">
                Connected
              </Badge>
            </CardAction>
          )}
          <CardDescription>
            {integration.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col justify-end">
          {integration.href ? (
            isConnected ? (
              <Button 
                className="w-full border-purple-600 text-purple-600 hover:bg-purple-50" 
                variant="outline" 
                asChild
              >
                <Link href={integration.href}>Edit connection</Link>
              </Button>
            ) : (
              <Button className="w-full" asChild>
                <Link href={integration.href}>Connect</Link>
              </Button>
            )
          ) : (
            <Button className="w-full" disabled>
              Coming Soon
            </Button>
          )}
        </CardContent>
    </Card>
  );
}
