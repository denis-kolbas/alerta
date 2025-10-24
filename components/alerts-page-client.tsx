'use client';

import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle, CheckCircle2, XCircle, Search } from 'lucide-react';
import { AlertsTable } from './alerts-table';
import { AlertEventChart } from './alert-event-chart';
import { NotificationBanner } from './notification-banner';
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
  const searchParams = useSearchParams();
  
  const [selectedEvent, setSelectedEvent] = useState<{
    eventName: string;
    integrationName: string;
  } | null>(null);
  const [eventData, setEventData] = useState<EventDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Filters - initialize from URL params
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || 'all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [platformFilter, setPlatformFilter] = useState<string>(searchParams.get('integration') || 'all');
  const [searchTerm, setSearchTerm] = useState('');

  // Update filters when URL params change
  useEffect(() => {
    const status = searchParams.get('status');
    const integration = searchParams.get('integration');
    
    if (status) setStatusFilter(status);
    if (integration) setPlatformFilter(integration);
  }, [searchParams]);

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
      {stats.active === 0 ? (
        <NotificationBanner
          icon={CheckCircle2}
          title="All clear!"
          description="No active alerts. Everything is running smoothly. Sit back and relax."
          variant="neutral"
        />
      ) : stats.critical > 0 ? (
        <NotificationBanner
          icon={XCircle}
          title={`${stats.critical} critical ${stats.critical === 1 ? 'alert' : 'alerts'} require attention`}
          description={
            mostRecentCritical
              ? `Pay attention to ${mostRecentCritical.eventName} from ${mostRecentCritical.integrationName}.${stats.active > stats.critical ? ` Plus ${stats.active - stats.critical} other active ${stats.active - stats.critical === 1 ? 'alert' : 'alerts'}.` : ''}`
              : undefined
          }
          variant="neutral"
        />
      ) : (
        <NotificationBanner
          icon={AlertCircle}
          title={`${stats.active} active ${stats.active === 1 ? 'alert' : 'alerts'}`}
          description="You have warnings that should be reviewed. No critical issues detected."
          variant="neutral"
        />
      )}

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
