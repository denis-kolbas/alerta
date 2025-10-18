'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { useState } from 'react';
import { disconnectIntegration } from '@/app/dashboard/integrations/actions';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface Integration {
  id: string;
  name: string;
  description: string;
  logo: string;
  category: string;
  href: string | null;
}

interface IntegrationCardProps {
  integration: Integration;
  isConnected: boolean;
}

export function IntegrationCard({ integration, isConnected }: IntegrationCardProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleDisconnect = async () => {
    setIsLoading(true);
    try {
      const result = await disconnectIntegration(integration.id);
      if (result.success) {
        toast.success(`${integration.name} disconnected successfully`);
        router.refresh();
      } else {
        toast.error(result.error || 'Failed to disconnect');
      }
    } catch {
      toast.error('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="text-4xl">{integration.logo}</div>
            <div>
              <CardTitle className="flex items-center gap-2">
                {integration.name}
                {isConnected && (
                  <Badge variant="default" className="bg-green-600">
                    Connected
                  </Badge>
                )}
              </CardTitle>
              <Badge variant="secondary" className="mt-1">
                {integration.category}
              </Badge>
            </div>
          </div>
        </div>
        <CardDescription className="mt-3">
          {integration.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-end">
        {integration.href ? (
          isConnected ? (
            <Button 
              className="w-full" 
              variant="destructive" 
              onClick={handleDisconnect}
              disabled={isLoading}
            >
              {isLoading ? 'Disconnecting...' : 'Disconnect'}
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
