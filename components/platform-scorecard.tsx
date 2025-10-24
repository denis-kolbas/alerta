'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import Link from 'next/link';
import { formatDistanceToNow, differenceInMinutes } from 'date-fns';
import { IntegrationIcon } from '@/lib/integrations';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

function formatLastSync(date: Date): string {
  const minutesAgo = differenceInMinutes(new Date(), date);
  
  if (minutesAgo < 60) {
    return `${minutesAgo} ${minutesAgo === 1 ? 'minute' : 'minutes'} ago`;
  }
  
  return formatDistanceToNow(date, { addSuffix: true });
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(2).replace(/\.?0+$/, '') + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.?0+$/, '') + 'K';
  }
  return num.toLocaleString();
}

interface PlatformScorecardProps {
  platform: string;
  lastSyncTime: Date | null;
  eventCount: number;
  percentChange: number | null;
  activeAlerts: number;
  uniqueEvents: number;
  sparklineData: Array<{ date: string; total: number }>;
  timeRange?: '7d' | '30d' | '90d';
  detailsUrl: string;
}

export function PlatformScorecard({
  platform,
  lastSyncTime,
  eventCount,
  percentChange,
  activeAlerts,
  uniqueEvents,
  timeRange = '30d',
  detailsUrl,
}: PlatformScorecardProps) {
  const platformName = platform.charAt(0).toUpperCase() + platform.slice(1);
  const timeRangeLabel = timeRange === '7d' ? '7d' : timeRange === '30d' ? '30d' : '90d';

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
    <Card className="flex flex-col p-6">
      <CardHeader className="p-0">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 flex items-center justify-center flex-shrink-0">
            <IntegrationIcon integrationId={platform.toLowerCase()} size="default" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg">{platformName}</h3>
            <p className="text-xs text-muted-foreground mt-0.5" suppressHydrationWarning>
              {lastSyncTime
                ? `Last synced ${formatLastSync(lastSyncTime)}`
                : 'No data yet'}
            </p>
          </div>
          {activeAlerts > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href={detailsUrl}>
                  <span className="rounded-full bg-red-200 px-2 py-0.5 text-xs font-semibold text-red-800 cursor-pointer hover:bg-red-300 transition-colors">
                    {activeAlerts}
                  </span>
                </Link>
              </TooltipTrigger>
              <TooltipContent>
                <p>{activeAlerts} active {activeAlerts === 1 ? 'alert' : 'alerts'}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Events tracked</p>
            <p className="text-2xl font-bold">{uniqueEvents}</p>
          </div>
          
          <div>
            <p className="text-xs text-muted-foreground mb-1">{timeRangeLabel} volume</p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold">{formatNumber(eventCount)}</p>
              <span className={`text-sm font-medium flex items-center gap-0.5 ${getTrendColor()}`}>
                {percentChange !== null ? (
                  <>
                    {getTrendIcon()}
                    {Math.abs(percentChange).toFixed(0)}%
                  </>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </span>
            </div>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}
