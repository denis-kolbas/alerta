'use client';

import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CheckCircle2, XCircle, AlertCircle, ChevronDown } from 'lucide-react';
import { updateAlertStatus } from '@/app/dashboard/alerts/actions';
import { IntegrationFavicon } from '@/lib/integrations';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

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

const getSeverityBadgeClass = (severity: string) => {
  switch (severity) {
    case 'critical':
      return 'bg-red-50 text-red-700 border-red-200 hover:bg-red-50';
    case 'warning':
      return 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-50';
    case 'info':
      return 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-50';
    default:
      return 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-50';
  }
};

export function AlertsTable({ alerts, onAlertClick }: AlertsTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const handleStatusChange = async (alertId: number, newStatus: string) => {
    const result = await updateAlertStatus(alertId, newStatus as 'active' | 'resolved' | 'dismissed');
    
    if (result.error) {
      console.error('Failed to update alert status:', result.error);
    }
  };

  const handleRowClick = (eventName: string, integrationName: string, e: React.MouseEvent) => {
    // Don't trigger if clicking on the dropdown menu
    if ((e.target as HTMLElement).closest('[role="menu"]') || (e.target as HTMLElement).closest('button')) {
      return;
    }
    onAlertClick?.(eventName, integrationName);
  };

  // Pagination
  const totalPages = Math.ceil(alerts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedAlerts = alerts.slice(startIndex, endIndex);

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="border rounded-lg overflow-hidden bg-card">
        <div className="bg-muted/50 px-4 py-3 border-b">
          <div className="grid grid-cols-[100px_60px_minmax(150px,250px)_100px_1fr_140px] gap-4 items-center">
            <span className="text-sm font-medium">Time</span>
            <span className="text-sm font-medium text-center">Source</span>
            <span className="text-sm font-medium">Event</span>
            <span className="text-sm font-medium">Severity</span>
            <span className="text-sm font-medium">Message</span>
            <span className="text-sm font-medium text-right">Status</span>
          </div>
        </div>
        <div className="max-h-[600px] overflow-y-auto">
          {paginatedAlerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-muted-foreground py-12">
              <CheckCircle2 className="h-10 w-10 mb-2" />
              <p className="text-sm font-medium">No alerts</p>
              <p className="text-xs">Everything is working as intended</p>
            </div>
          ) : (
            paginatedAlerts.map((alert) => {
              const currentStatus = alert.status || 'active';
              const isDimmed = currentStatus === 'resolved' || currentStatus === 'dismissed';
              
              return (
                <div
                  key={alert.id}
                  className={`grid grid-cols-[100px_60px_minmax(150px,250px)_100px_1fr_140px] gap-4 items-center px-4 py-3 border-b last:border-b-0 hover:bg-muted/30 transition-colors ${isDimmed ? 'opacity-60' : ''} ${onAlertClick ? 'cursor-pointer' : ''}`}
                  onClick={(e) => handleRowClick(alert.eventName, alert.integrationName || 'unknown', e)}
                >
                  <span className="text-sm text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(alert.createdAt))}
                  </span>
                  <div className="flex items-center justify-center">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div>
                          <IntegrationFavicon integrationId={alert.integrationName || 'unknown'} />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="capitalize">{alert.integrationName || 'unknown'}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="font-medium truncate" title={alert.eventName}>
                    {alert.eventName}
                  </div>
                  <div>
                    <Badge 
                      variant="outline" 
                      className={getSeverityBadgeClass(alert.severity)}
                    >
                      {alert.severity}
                    </Badge>
                  </div>
                  <p className="text-sm truncate" title={alert.message}>
                    {alert.message}
                  </p>
                  <div className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Badge 
                          variant="outline" 
                          className="capitalize cursor-pointer inline-flex items-center gap-1 hover:bg-accent"
                        >
                          {currentStatus}
                          <ChevronDown className="h-3 w-3" />
                        </Badge>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem 
                          onClick={() => handleStatusChange(alert.id, 'active')}
                          disabled={currentStatus === 'active'}
                        >
                          <AlertCircle className="mr-2 h-4 w-4 text-red-600" />
                          Mark as Active
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleStatusChange(alert.id, 'resolved')}
                          disabled={currentStatus === 'resolved'}
                        >
                          <CheckCircle2 className="mr-2 h-4 w-4 text-green-600" />
                          Mark as Resolved
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleStatusChange(alert.id, 'dismissed')}
                          disabled={currentStatus === 'dismissed'}
                        >
                          <XCircle className="mr-2 h-4 w-4 text-gray-600" />
                          Mark as Dismissed
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {alerts.length > itemsPerPage && (
        <div className="flex items-center justify-end space-x-2 py-4">
          <div className="text-muted-foreground flex-1 text-sm">
            {startIndex + 1}-{Math.min(endIndex, alerts.length)} of {alerts.length}
          </div>
          <div className="space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
      </div>
    </TooltipProvider>
  );
}
