'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle, CheckCircle2, XCircle, Search } from 'lucide-react';
import { AlertsTable } from './alerts-table';
import { AlertEventChart } from './alert-event-chart';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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

interface AlertsPageClientProps {
  alerts: Alert[];
  platforms: string[];
}

export function AlertsPageClient({ alerts, platforms }: AlertsPageClientProps) {
  const [selectedEvent, setSelectedEvent] = useState<{
    eventName: string;
    integrationName: string;
  } | null>(null);
  const [eventData, setEventData] = useState<EventDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Calculate stats
  const stats = useMemo(() => {
    const active = alerts.filter(a => a.status === 'active' || (!a.status && !a.isResolved)).length;
    const critical = alerts.filter(a => a.severity === 'critical' && (a.status === 'active' || (!a.status && !a.isResolved))).length;
    const resolved = alerts.filter(a => a.status === 'resolved' || a.isResolved).length;
    
    return { active, critical, resolved, total: alerts.length };
  }, [alerts]);

  // Filter alerts
  const filteredAlerts = useMemo(() => {
    return alerts.filter(alert => {
      // Status filter
      if (statusFilter !== 'all') {
        const alertStatus = alert.status || (alert.isResolved ? 'resolved' : 'active');
        if (alertStatus !== statusFilter) return false;
      }

      // Severity filter
      if (severityFilter !== 'all' && alert.severity !== severityFilter) return false;

      // Platform filter
      if (platformFilter !== 'all' && alert.integrationName !== platformFilter) return false;

      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        return (
          alert.eventName.toLowerCase().includes(search) ||
          alert.message.toLowerCase().includes(search) ||
          alert.integrationName?.toLowerCase().includes(search)
        );
      }

      return true;
    });
  }, [alerts, statusFilter, severityFilter, platformFilter, searchTerm]);

  async function handleAlertClick(eventName: string, integrationName: string) {
    setSelectedEvent({ eventName, integrationName });
    setIsLoading(true);

    try {
      const response = await fetch(
        `/api/event-data?eventName=${encodeURIComponent(eventName)}&integrationName=${encodeURIComponent(integrationName)}`
      );
      
      if (response.ok) {
        const data = await response.json();
        setEventData(data);
      } else {
        setEventData([]);
      }
    } catch (error) {
      console.error('Error fetching event data:', error);
      setEventData([]);
    } finally {
      setIsLoading(false);
    }
  }

  // Get most critical alert info
  const criticalAlerts = alerts.filter(a => a.severity === 'critical' && (a.status === 'active' || (!a.status && !a.isResolved)));
  const mostRecentCritical = criticalAlerts.length > 0 ? criticalAlerts[0] : null;

  return (
    <div className="space-y-6">
      {/* Status Summary */}
      <Card className={stats.active === 0 ? 'border-green-200 bg-green-50/50 py-0' : stats.critical > 0 ? 'border-red-200 bg-red-50/50 py-0' : 'border-orange-200 bg-orange-50/50 py-0'}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            {stats.active === 0 ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-green-900">All clear!</h3>
                  <p className="text-sm text-green-700 mt-0.5">
                    No active alerts. Everything is running smoothly. Sit back and relax.
                  </p>
                </div>
              </>
            ) : stats.critical > 0 ? (
              <>
                <XCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="font-semibold text-red-900">
                    {stats.critical} critical {stats.critical === 1 ? 'alert' : 'alerts'} require attention
                  </h3>
                  <p className="text-sm text-red-700 mt-0.5">
                    {mostRecentCritical && (
                      <>Pay attention to <span className="font-medium">{mostRecentCritical.eventName}</span> from {mostRecentCritical.integrationName}. </>
                    )}
                    {stats.active > stats.critical && `Plus ${stats.active - stats.critical} other active ${stats.active - stats.critical === 1 ? 'alert' : 'alerts'}.`}
                  </p>
                </div>
              </>
            ) : (
              <>
                <AlertCircle className="h-5 w-5 text-orange-600 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-orange-900">
                    {stats.active} active {stats.active === 1 ? 'alert' : 'alerts'}
                  </h3>
                  <p className="text-sm text-orange-700 mt-0.5">
                    You have warnings that should be reviewed. No critical issues detected.
                  </p>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search alerts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-background"
          />
        </div>
        
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full md:w-[150px] bg-background">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="dismissed">Dismissed</SelectItem>
          </SelectContent>
        </Select>

        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-full md:w-[150px] bg-background">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severity</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
          </SelectContent>
        </Select>

        <Select value={platformFilter} onValueChange={setPlatformFilter}>
          <SelectTrigger className="w-full md:w-[150px] bg-background">
            <SelectValue placeholder="Platform" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Platforms</SelectItem>
            {platforms.map(platform => (
              <SelectItem key={platform} value={platform}>
                {platform.charAt(0).toUpperCase() + platform.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(statusFilter !== 'all' || severityFilter !== 'all' || platformFilter !== 'all' || searchTerm) && (
          <Button
            variant="ghost"
            onClick={() => {
              setStatusFilter('all');
              setSeverityFilter('all');
              setPlatformFilter('all');
              setSearchTerm('');
            }}
          >
            Clear
          </Button>
        )}
      </div>

      {/* Alerts Table */}
      <AlertsTable alerts={filteredAlerts} onAlertClick={handleAlertClick} />

      {/* Event Chart */}
      {selectedEvent && (
        <Card>
          <CardHeader>
            <CardTitle>Event Volume: {selectedEvent.eventName}</CardTitle>
            <p className="text-sm text-muted-foreground">
              Hourly event counts from {selectedEvent.integrationName}
            </p>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <p className="text-muted-foreground">Loading event data...</p>
              </div>
            ) : (
              <AlertEventChart
                eventName={selectedEvent.eventName}
                integrationName={selectedEvent.integrationName}
                eventData={eventData}
              />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
