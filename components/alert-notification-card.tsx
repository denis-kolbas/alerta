'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, X, RotateCcw } from 'lucide-react';
import { IntegrationFavicon } from '@/lib/integrations';
import { formatDistanceToNow } from 'date-fns';
import { updateAlertStatus } from '@/app/dashboard/alerts/actions';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { format } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Alert {
  id: number;
  brandName: string;
  eventName: string;
  ruleType: string;
  severity: string;
  message: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  resolvedAt: Date | null;
  isResolved: boolean;
  status?: 'active' | 'resolved' | 'dismissed';
  integrationName?: string | null;
}

interface EventDataPoint {
  timestamp: Date;
  count: number;
}

interface AlertNotificationCardProps {
  alert: Alert;
  eventData?: EventDataPoint[];
  onResolve: (id: number) => void;
  onDismiss: (id: number) => void;
  onStatusChange?: (id: number, status: 'active' | 'resolved' | 'dismissed') => void;
}

const chartConfig = {
  count: {
    label: 'Events',
    color: 'var(--chart-1)',
  },
} satisfies ChartConfig;

export function AlertNotificationCard({ alert, eventData, onResolve, onDismiss, onStatusChange }: AlertNotificationCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(alert.status || 'active');

  const handleStatusChange = async (newStatus: 'active' | 'resolved' | 'dismissed') => {
    setIsLoading(true);
    const result = await updateAlertStatus(alert.id, newStatus);
    if (!result.error) {
      setCurrentStatus(newStatus);
      
      // Call the appropriate callback
      if (newStatus === 'resolved') {
        onResolve(alert.id);
      } else if (newStatus === 'dismissed') {
        onDismiss(alert.id);
      }
      
      // Also call the general status change callback if provided
      if (onStatusChange) {
        onStatusChange(alert.id, newStatus);
      }
    }
    setIsLoading(false);
  };

  // Prepare chart data
  const chartData = Array.isArray(eventData) ? eventData.map(d => ({
    date: format(new Date(d.timestamp), 'yyyy-MM-dd HH:mm'),
    count: d.count,
  })) : [];

  const getSeverityBadgeClass = () => {
    switch (alert.severity) {
      case 'critical':
        return 'bg-red-50 text-red-700 border-red-200 hover:bg-red-50';
      case 'warning':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-50';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-50';
    }
  };

  return (
    <Card className="py-0">
      <CardContent className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-xs text-muted-foreground mb-1">
              {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
            </div>
            
            <div className="flex items-center gap-2 mb-2">
              {alert.integrationName && (
                <IntegrationFavicon integrationId={alert.integrationName} />
              )}
              <span className="text-sm font-medium capitalize">{alert.integrationName}</span>
              <Badge variant="outline" className={getSeverityBadgeClass()}>
                {alert.severity}
              </Badge>
            </div>
            
            <h3 className="font-semibold text-base mb-1">{alert.eventName}</h3>
            <p className="text-sm text-muted-foreground">{alert.message}</p>
          </div>
          
          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {currentStatus === 'active' && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => handleStatusChange('resolved')}
                  disabled={isLoading}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                  Resolve
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => handleStatusChange('dismissed')}
                  disabled={isLoading}
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  Dismiss
                </Button>
              </>
            )}
            
            {currentStatus === 'resolved' && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 hover:bg-green-50 cursor-pointer">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Resolved
                  </Badge>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleStatusChange('active')}>
                    <RotateCcw className="h-3.5 w-3.5 mr-2" />
                    Reopen
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleStatusChange('dismissed')}>
                    <X className="h-3.5 w-3.5 mr-2" />
                    Dismiss
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            
            {currentStatus === 'dismissed' && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-50 cursor-pointer">
                    <X className="h-3 w-3 mr-1" />
                    Dismissed
                  </Badge>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleStatusChange('active')}>
                    <RotateCcw className="h-3.5 w-3.5 mr-2" />
                    Reopen
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleStatusChange('resolved')}>
                    <CheckCircle2 className="h-3.5 w-3.5 mr-2" />
                    Resolve
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Chart */}
        {chartData.length > 0 && (
          <div className="pt-2">
            <ChartContainer config={chartConfig} className="h-32 w-full">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id={`fill-${alert.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={32}
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    return format(date, 'MMM d HH:mm');
                  }}
                  className="text-xs"
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(value) => value.toLocaleString()}
                  className="text-xs"
                />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      labelFormatter={(value) => format(new Date(value as string), 'MMM d, HH:mm')}
                      indicator="dot"
                    />
                  }
                />
                <Area
                  dataKey="count"
                  type="monotone"
                  fill={`url(#fill-${alert.id})`}
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          </div>
        )}

      </CardContent>
    </Card>
  );
}
