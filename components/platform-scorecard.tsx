'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { IntegrationIcon } from '@/lib/integrations';

interface PlatformScorecardProps {
  platform: string;
  lastSyncTime: Date | null;
  eventCount: number;
  percentChange: number | null;
  activeAlerts: number;
  detailsUrl: string;
}

export function PlatformScorecard({
  platform,
  lastSyncTime,
  eventCount,
  percentChange,
  activeAlerts,
  detailsUrl,
}: PlatformScorecardProps) {
  const platformName = platform.charAt(0).toUpperCase() + platform.slice(1);

  const getTrendIcon = () => {
    if (percentChange === null || percentChange === 0) {
      return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
    if (percentChange > 0) {
      return <TrendingUp className="h-4 w-4 text-green-600" />;
    }
    return <TrendingDown className="h-4 w-4 text-red-600" />;
  };

  const getTrendColor = () => {
    if (percentChange === null || percentChange === 0) {
      return 'text-muted-foreground';
    }
    return percentChange > 0 ? 'text-green-600' : 'text-red-600';
  };

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 flex items-center justify-center flex-shrink-0">
            <IntegrationIcon integrationId={platform.toLowerCase()} size="default" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg">{platformName}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {lastSyncTime
                ? `Last synced ${formatDistanceToNow(lastSyncTime, { addSuffix: true })}`
                : 'No data yet'}
            </p>
          </div>
        </div>
        
        <div className="flex items-baseline gap-2 mt-4">
          <p className="text-2xl font-bold">{Number(eventCount).toLocaleString()}</p>
          <p className="text-sm text-muted-foreground">Event volume</p>
        </div>

        {percentChange !== null && (
          <div className="flex items-center gap-1.5">
            <span className={`text-sm font-medium ${getTrendColor()}`}>
              Trending {percentChange > 0 ? 'up' : percentChange < 0 ? 'down' : 'flat'} by {Math.abs(percentChange).toFixed(1)}% this period
            </span>
            {getTrendIcon()}
          </div>
        )}
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col justify-end">
        <div className="flex items-center justify-between pt-3 border-t">
          <div>
            <span className="text-sm font-medium">{activeAlerts}</span>
            <span className="text-sm text-muted-foreground ml-1">
              active {activeAlerts === 1 ? 'alert' : 'alerts'}
            </span>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href={detailsUrl} className="gap-1">
              View details
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
