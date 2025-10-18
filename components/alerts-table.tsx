'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertCircle, TrendingUp, TrendingDown, Volume2, CheckCircle2, XCircle } from 'lucide-react';
import { updateAlertStatus } from '@/app/dashboard/analytics/actions';

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

function formatDistanceToNow(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

interface AlertsTableProps {
  alerts: Alert[];
  onAlertClick?: (eventName: string, integrationName: string) => void;
}

const ruleIcons = {
  silence_detection: Volume2,
  spike_detection: TrendingUp,
  drop_detection: TrendingDown,
};

const ruleLabels = {
  silence_detection: 'Silence',
  spike_detection: 'Spike',
  drop_detection: 'Drop',
};

const severityColors = {
  critical: 'destructive',
  warning: 'default',
  info: 'secondary',
} as const;

export function AlertsTable({ alerts, onAlertClick }: AlertsTableProps) {
  const handleStatusChange = async (alertId: number, newStatus: string) => {
    const result = await updateAlertStatus(alertId, newStatus as 'active' | 'resolved' | 'dismissed');
    
    if (result.error) {
      console.error('Failed to update alert status:', result.error);
    }
  };

  const handleRowClick = (eventName: string, integrationName: string, e: React.MouseEvent) => {
    // Don't trigger if clicking on the select dropdown
    if ((e.target as HTMLElement).closest('[role="combobox"]')) {
      return;
    }
    onAlertClick?.(eventName, integrationName);
  };

  const unresolvedCount = alerts.filter(a => !a.isResolved).length;
  const resolvedCount = alerts.filter(a => a.isResolved).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Alerts</CardTitle>
            <CardDescription>
              Anomaly detection alerts for your events
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="destructive" className="h-6">
              {unresolvedCount} Active
            </Badge>
            <Badge variant="secondary" className="h-6">
              {resolvedCount} Resolved
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <CheckCircle2 className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No alerts</p>
            <p className="text-sm text-muted-foreground">
              All events are operating normally
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Time</TableHead>
                <TableHead className="w-[120px]">Integration</TableHead>
                <TableHead className="w-[200px]">Event</TableHead>
                <TableHead className="w-[100px]">Type</TableHead>
                <TableHead className="w-[100px]">Severity</TableHead>
                <TableHead className="min-w-[200px]">Message</TableHead>
                <TableHead className="w-[160px] text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alerts.map((alert) => {
                const Icon = ruleIcons[alert.ruleType as keyof typeof ruleIcons] || AlertCircle;
                const currentStatus = alert.status || 'active';
                const isDimmed = currentStatus === 'resolved' || currentStatus === 'dismissed';
                
                return (
                  <TableRow 
                    key={alert.id} 
                    className={`${isDimmed ? 'opacity-60' : ''} ${onAlertClick ? 'cursor-pointer hover:bg-muted/50' : ''}`}
                    onClick={(e) => handleRowClick(alert.eventName, alert.integrationName || 'unknown', e)}
                  >
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {alert.isResolved && alert.resolvedAt
                        ? formatDistanceToNow(new Date(alert.resolvedAt))
                        : formatDistanceToNow(new Date(alert.createdAt))}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {alert.integrationName || 'unknown'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium max-w-[200px]">
                      <div className="truncate" title={alert.eventName}>
                        {alert.eventName}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          {ruleLabels[alert.ruleType as keyof typeof ruleLabels] || alert.ruleType}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Badge variant={severityColors[alert.severity as keyof typeof severityColors] || 'default'}>
                        {alert.severity}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[300px]">
                      <p className="text-sm truncate" title={alert.message}>
                        {alert.message}
                      </p>
                    </TableCell>
                    <TableCell className="text-right">
                      <Select
                        value={currentStatus}
                        onValueChange={(value) => handleStatusChange(alert.id, value)}
                      >
                        <SelectTrigger className="w-[140px] ml-auto">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">
                            <div className="flex items-center gap-2">
                              <AlertCircle className="h-4 w-4 text-destructive" />
                              <span>Active</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="resolved">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                              <span>Resolved</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="dismissed">
                            <div className="flex items-center gap-2">
                              <XCircle className="h-4 w-4 text-muted-foreground" />
                              <span>Dismissed</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
