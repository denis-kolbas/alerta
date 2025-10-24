'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
    <Card className="flex flex-col transition-colors duration-200 hover:border-primary/40 overflow-hidden">
        <CardHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 flex items-center justify-center flex-shrink-0">
              <IntegrationIcon integrationId={integration.id} size="large" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="truncate">{integration.name}</CardTitle>
                {isConnected && (
                  <Badge variant="default" className="bg-green-600 whitespace-nowrap flex-shrink-0 text-xs">
                    Connected
                  </Badge>
                )}
              </div>
              <span className="mt-1 text-xs text-muted-foreground">
                {integration.category}
              </span>
            </div>
          </div>
          <CardDescription className="line-clamp-2">
            {integration.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col justify-end">
          {integration.href ? (
            isConnected ? (
              <Button 
                className="w-full border-primary text-primary hover:bg-primary/10" 
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
