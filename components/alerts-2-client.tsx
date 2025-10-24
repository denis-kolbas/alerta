'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, ChevronLeft, ChevronRight, ChevronDown, X, CheckCircle2 } from 'lucide-react';
import { AlertNotificationCard } from './alert-notification-card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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

interface Alerts2ClientProps {
  alerts: Alert[];
  platforms: string[];
}

export function Alerts2Client({ alerts: initialAlerts, platforms }: Alerts2ClientProps) {
  const [alerts, setAlerts] = useState(initialAlerts);
  const [eventDataMap, setEventDataMap] = useState<Record<number, EventDataPoint[]>>({});
  const [loadingEvents, setLoadingEvents] = useState<Record<number, boolean>>({});
  
  // Filters - now arrays for multi-select
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(['active']);
  const [selectedSeverities, setSelectedSeverities] = useState<string[]>(['critical', 'warning']);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(platforms);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Update selected platforms when platforms prop changes
  useEffect(() => {
    setSelectedPlatforms(platforms);
  }, [platforms]);



  // Count alerts by status
  const statusCounts = useMemo(() => {
    const counts = { active: 0, resolved: 0, dismissed: 0 };
    alerts.forEach(alert => {
      const alertStatus = alert.status || (alert.isResolved ? 'resolved' : 'active');
      if (alertStatus in counts) {
        counts[alertStatus as keyof typeof counts]++;
      }
    });
    return counts;
  }, [alerts]);

  // Filter alerts
  const filteredAlerts = useMemo(() => {
    return alerts.filter(alert => {
      // Status filter - check if alert status is in selected statuses
      if (selectedStatuses.length > 0) {
        const alertStatus = alert.status || (alert.isResolved ? 'resolved' : 'active');
        if (!selectedStatuses.includes(alertStatus)) return false;
      }

      // Severity filter - check if alert severity is in selected severities
      if (selectedSeverities.length > 0 && !selectedSeverities.includes(alert.severity)) {
        return false;
      }

      // Platform filter - check if alert platform is in selected platforms
      if (selectedPlatforms.length > 0 && alert.integrationName && !selectedPlatforms.includes(alert.integrationName)) {
        return false;
      }

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
  }, [alerts, selectedStatuses, selectedSeverities, selectedPlatforms, searchTerm]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredAlerts.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedAlerts = filteredAlerts.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedStatuses, selectedSeverities, selectedPlatforms, searchTerm]);

  // Fetch event data for each alert (24 hours before alert) - only for current page
  useEffect(() => {
    paginatedAlerts.forEach(alert => {
      if (!eventDataMap[alert.id] && !loadingEvents[alert.id] && alert.integrationName) {
        setLoadingEvents(prev => ({ ...prev, [alert.id]: true }));
        
        // Get 24 hours before the alert was created
        const alertTime = new Date(alert.createdAt).toISOString();
        
        fetch(`/api/event-data?eventName=${encodeURIComponent(alert.eventName)}&integrationName=${encodeURIComponent(alert.integrationName)}&endTime=${encodeURIComponent(alertTime)}&hours=24`)
          .then(res => res.json())
          .then(data => {
            setEventDataMap(prev => ({ ...prev, [alert.id]: data }));
            setLoadingEvents(prev => ({ ...prev, [alert.id]: false }));
          })
          .catch(() => {
            setLoadingEvents(prev => ({ ...prev, [alert.id]: false }));
          });
      }
    });
  }, [paginatedAlerts, eventDataMap, loadingEvents]);

  const handleStatusChange = (id: number, newStatus: 'active' | 'resolved' | 'dismissed') => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a));
  };

  const handleResolve = (id: number) => {
    handleStatusChange(id, 'resolved');
  };

  const handleDismiss = (id: number) => {
    handleStatusChange(id, 'dismissed');
  };

  const handleClearFilters = () => {
    setSelectedStatuses(['active']);
    setSelectedSeverities(['critical', 'warning']);
    setSelectedPlatforms(platforms);
    setSearchTerm('');
  };

  // Check if filters are in default state
  const isDefaultFilters = 
    selectedStatuses.length === 1 && 
    selectedStatuses[0] === 'active' && 
    selectedSeverities.length === 2 && 
    selectedPlatforms.length === platforms.length && 
    !searchTerm;

  return (
    <div className="space-y-6">
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

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Status</span>
          <div className="inline-flex rounded-md shadow-sm">
            {['active', 'resolved', 'dismissed'].map((status, index) => {
              const count = statusCounts[status as keyof typeof statusCounts];
              return (
                <Button
                  key={status}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const checked = !selectedStatuses.includes(status);
                    setSelectedStatuses(prev =>
                      checked ? [...prev, status] : prev.filter(s => s !== status)
                    );
                  }}
                  className={`
                    ${index === 0 ? 'rounded-r-none' : index === 2 ? 'rounded-l-none -ml-px' : 'rounded-none -ml-px'}
                    ${selectedStatuses.includes(status) ? 'bg-gray-800 hover:bg-gray-900 text-white hover:text-white border-gray-800' : ''}
                  `}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                  <span className="ml-1.5 text-xs opacity-60">{count}</span>
                </Button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Severity</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                {selectedSeverities.length > 0 && selectedSeverities.length < 2 && (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                    {selectedSeverities.length}
                  </span>
                )}
                <span>All</span>
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[200px]">
              <DropdownMenuLabel>Filter by Severity</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-accent rounded-sm" onClick={() => {
                const checked = !selectedSeverities.includes('critical');
                setSelectedSeverities(prev =>
                  checked ? [...prev, 'critical'] : prev.filter(s => s !== 'critical')
                );
              }}>
                <Checkbox 
                  checked={selectedSeverities.includes('critical')}
                  className="data-[state=checked]:bg-[#8b5cf6] data-[state=checked]:border-[#8b5cf6]"
                />
                <span className="text-sm">Critical</span>
              </div>
              <div className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-accent rounded-sm" onClick={() => {
                const checked = !selectedSeverities.includes('warning');
                setSelectedSeverities(prev =>
                  checked ? [...prev, 'warning'] : prev.filter(s => s !== 'warning')
                );
              }}>
                <Checkbox 
                  checked={selectedSeverities.includes('warning')}
                  className="data-[state=checked]:bg-[#8b5cf6] data-[state=checked]:border-[#8b5cf6]"
                />
                <span className="text-sm">Warning</span>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Platform</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                {selectedPlatforms.length > 0 && selectedPlatforms.length < platforms.length && (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                    {selectedPlatforms.length}
                  </span>
                )}
                <span>All</span>
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[200px]">
              <DropdownMenuLabel>Filter by Platform</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {platforms.map(platform => (
                <div 
                  key={platform}
                  className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-accent rounded-sm" 
                  onClick={() => {
                    const checked = !selectedPlatforms.includes(platform);
                    setSelectedPlatforms(prev =>
                      checked ? [...prev, platform] : prev.filter(p => p !== platform)
                    );
                  }}
                >
                  <Checkbox 
                    checked={selectedPlatforms.includes(platform)}
                    className="data-[state=checked]:bg-[#8b5cf6] data-[state=checked]:border-[#8b5cf6]"
                  />
                  <span className="text-sm">{platform.charAt(0).toUpperCase() + platform.slice(1)}</span>
                </div>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Button 
          variant="ghost" 
          size="sm"
          onClick={handleClearFilters}
          disabled={isDefaultFilters}
          className={`transition-opacity ${isDefaultFilters ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
        >
          <X className="h-4 w-4 mr-1" />
          Clear
        </Button>
      </div>

      {/* Alert Notifications */}
      <div className="space-y-4">
        {filteredAlerts.length === 0 ? (
          <Card className="border-border bg-card shadow-sm">
            <CardContent className="py-12 flex flex-col items-center justify-center text-center">
              {selectedStatuses.length === 1 && selectedStatuses[0] === 'active' && selectedSeverities.length === 2 && selectedPlatforms.length === platforms.length && !searchTerm ? (
                <>
                  <div className="rounded-full p-2 text-primary bg-primary/10 mb-4">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold leading-none tracking-tight text-gray-900 mb-2">No active alerts</h3>
                  <p className="text-sm text-gray-600">Everything is working as intended. Sit back and relax.</p>
                </>
              ) : (
                <p className="text-muted-foreground">No alerts match your filters</p>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            {paginatedAlerts.map(alert => (
              <AlertNotificationCard
                key={alert.id}
                alert={alert}
                eventData={eventDataMap[alert.id]}
                onResolve={handleResolve}
                onDismiss={handleDismiss}
                onStatusChange={handleStatusChange}
              />
            ))}
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <p className="text-sm text-muted-foreground">
                  Showing {startIndex + 1}-{Math.min(endIndex, filteredAlerts.length)} of {filteredAlerts.length} alerts
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <div className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
