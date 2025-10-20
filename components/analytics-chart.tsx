'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { ChevronDown, Search, Calendar as CalendarIcon } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';

interface EventDataPoint {
  id: number;
  brand: string;
  eventName: string;
  timestamp: Date;
  count: number;
  integrationName?: string | null;
}

interface AnalyticsChartProps {
  eventData: EventDataPoint[];
  availableEvents: string[];
  availableBrands: string[];
  selectedEvents?: string[];
  onSelectedEventsChange?: (events: string[]) => void;
  activeIntegrations?: string[];
  selectedIntegrations?: string[];
  onSelectedIntegrationsChange?: (integrations: string[]) => void;
}

// Purple gradient matching the theme
const COLORS = [
  '#8b5cf6', // Purple (chart-1)
  '#a78bfa', // Light purple (chart-2)
  '#c4b5fd', // Lighter purple (chart-3)
  '#ddd6fe', // Very light purple (chart-4)
  '#ede9fe', // Palest purple (chart-5)
];

export function AnalyticsChart({ 
  eventData, 
  availableEvents, 
  availableBrands,
  selectedEvents: controlledSelectedEvents,
  onSelectedEventsChange,
  activeIntegrations = [],
  selectedIntegrations: controlledSelectedIntegrations,
  onSelectedIntegrationsChange
}: AnalyticsChartProps) {
  const [internalSelectedEvents, setInternalSelectedEvents] = useState<string[]>(availableEvents.slice(0, 3));
  const [internalSelectedIntegrations, setInternalSelectedIntegrations] = useState<string[]>(activeIntegrations);
  const [selectedBrand, setSelectedBrand] = useState<string>(availableBrands[0] || '');
  const [searchTerm, setSearchTerm] = useState('');
  const [integrationSearchTerm, setIntegrationSearchTerm] = useState('');
  const [granularity, setGranularity] = useState<'hourly' | 'daily'>('hourly');
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });

  // Use controlled or internal state
  const selectedEvents = controlledSelectedEvents ?? internalSelectedEvents;
  const setSelectedEvents = onSelectedEventsChange ?? setInternalSelectedEvents;
  const selectedIntegrations = controlledSelectedIntegrations ?? internalSelectedIntegrations;
  const setSelectedIntegrations = onSelectedIntegrationsChange ?? setInternalSelectedIntegrations;

  const filteredEvents = useMemo(() => {
    return availableEvents.filter(event => {
      // Filter by search term
      if (!event.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      
      // Filter by selected integrations
      if (selectedIntegrations.length > 0) {
        const eventIntegration = event.split(':')[0].trim();
        return selectedIntegrations.includes(eventIntegration);
      }
      
      return true;
    });
  }, [availableEvents, searchTerm, selectedIntegrations]);

  const filteredIntegrations = useMemo(() => {
    return activeIntegrations.filter(integration =>
      integration.toLowerCase().includes(integrationSearchTerm.toLowerCase())
    );
  }, [activeIntegrations, integrationSearchTerm]);

  const chartData = useMemo(() => {
    const filteredData = eventData.filter(item => {
      // Create prefixed event name to match selectedEvents format
      const integration = item.integrationName || 'unknown';
      const prefixedEventName = `${integration}: ${item.eventName}`;
      
      // Filter by date range
      const itemDate = new Date(item.timestamp);
      if (dateRange.from && itemDate < dateRange.from) return false;
      if (dateRange.to) {
        const endOfDay = new Date(dateRange.to);
        endOfDay.setHours(23, 59, 59, 999);
        if (itemDate > endOfDay) return false;
      }
      
      return (!selectedBrand || item.brand === selectedBrand) &&
        selectedEvents.includes(prefixedEventName);
    });

    const timeGroups: { [key: string]: { [eventName: string]: number } } = {};
    
    filteredData.forEach(item => {
      const date = new Date(item.timestamp);
      // Group by hour or day based on granularity
      let timeKey: string;
      if (granularity === 'daily') {
        // Group by day (YYYY-MM-DD)
        timeKey = date.toISOString().split('T')[0];
      } else {
        // Group by hour (existing behavior)
        timeKey = date.toISOString();
      }
      
      if (!timeGroups[timeKey]) {
        timeGroups[timeKey] = {};
      }
      
      // Use prefixed name as key
      const integration = item.integrationName || 'unknown';
      const prefixedEventName = `${integration}: ${item.eventName}`;
      
      // Sum counts for daily aggregation
      timeGroups[timeKey][prefixedEventName] = 
        (timeGroups[timeKey][prefixedEventName] || 0) + item.count;
    });

    return Object.entries(timeGroups)
      .map(([timestamp, events]) => {
        const date = new Date(timestamp);
        return {
          timestamp,
          time: granularity === 'daily'
            ? date.toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                timeZone: 'UTC'
              })
            : date.toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                timeZone: 'UTC'
              }),
          ...events
        };
      })
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [eventData, selectedEvents, selectedBrand, granularity, dateRange]);

  // Sanitize event names for CSS variables (replace dots with dashes)
  const sanitizeEventName = (name: string) => name.replace(/\./g, '-');
  
  const chartConfig: ChartConfig = useMemo(() => {
    return selectedEvents.reduce((config, event, index) => {
      config[event] = {
        label: event,
        color: COLORS[index % COLORS.length],
      };
      return config;
    }, {} as ChartConfig);
  }, [selectedEvents]);

  return (
    <Card>
      <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
        <div className="grid flex-1 gap-1">
          <CardTitle>Event Analytics</CardTitle>
          <CardDescription>
            {granularity === 'hourly' ? 'Hourly' : 'Daily'} event counts over time (UTC)
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[240px] justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, 'MMM d, yyyy')} - {format(dateRange.to, 'MMM d, yyyy')}
                    </>
                  ) : (
                    format(dateRange.from, 'MMM d, yyyy')
                  )
                ) : (
                  <span>All time</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="range"
                selected={{ from: dateRange.from, to: dateRange.to }}
                onSelect={(range: any) => setDateRange({ from: range?.from, to: range?.to })}
                numberOfMonths={2}
              />
              <div className="p-3 border-t flex justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDateRange({ from: undefined, to: undefined })}
                >
                  Clear
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          
          <div className="flex items-center border rounded-md">
            <Button
              variant={granularity === 'hourly' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setGranularity('hourly')}
              className="rounded-r-none"
            >
              Hourly
            </Button>
            <Button
              variant={granularity === 'daily' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setGranularity('daily')}
              className="rounded-l-none"
            >
              Daily
            </Button>
          </div>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[280px] justify-start">
                <span className="text-sm">
                  {selectedEvents.length === 0 
                    ? "Select events..." 
                    : `${selectedEvents.length} event${selectedEvents.length !== 1 ? 's' : ''}`
                  }
                </span>
                <ChevronDown className="ml-auto h-4 w-4" />
              </Button>
            </PopoverTrigger>
              <PopoverContent className="w-[280px] p-3" align="end">
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span>{selectedEvents.length} of {availableEvents.length}</span>
                    <div className="space-x-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setSelectedEvents([])}
                      >
                        Clear
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setSelectedEvents(availableEvents)}
                      >
                        All
                      </Button>
                    </div>
                  </div>
                  
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                  
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {filteredEvents.length === 0 ? (
                      <div className="text-sm text-muted-foreground text-center py-2">
                        No events found
                      </div>
                    ) : (
                      filteredEvents.map(eventName => (
                        <div key={eventName} className="flex items-center space-x-2">
                          <Checkbox
                            id={eventName}
                            checked={selectedEvents.includes(eventName)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedEvents([...selectedEvents, eventName]);
                              } else {
                                setSelectedEvents(selectedEvents.filter(e => e !== eventName));
                              }
                            }}
                          />
                          <label htmlFor={eventName} className="text-sm cursor-pointer flex-1 truncate">
                            {eventName}
                          </label>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="flex h-80 items-center justify-center text-muted-foreground">
            No data available for selected events
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
            <AreaChart data={chartData}>
              <CartesianGrid vertical={false} />
              <XAxis 
                dataKey="time" 
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <ChartTooltip 
                cursor={false}
                content={
                  <ChartTooltipContent 
                    indicator="dot"
                    labelFormatter={(value, payload) => {
                      if (!payload?.[0]?.payload?.timestamp) return value;
                      const date = new Date(payload[0].payload.timestamp);
                      return granularity === 'daily'
                        ? date.toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            timeZone: 'UTC'
                          })
                        : date.toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            timeZone: 'UTC'
                          });
                    }}
                    formatter={(value, name) => (
                      <div className="flex items-center justify-between gap-4 w-full">
                        <span className="text-muted-foreground">{name}</span>
                        <span className="font-mono font-medium tabular-nums">{value.toLocaleString()}</span>
                      </div>
                    )}
                  />
                } 
              />
              <ChartLegend content={<ChartLegendContent />} />
              {selectedEvents.map((eventName, index) => {
                return (
                  <Area
                    key={eventName}
                    dataKey={eventName}
                    name={eventName}
                    type="monotone"
                    fill={COLORS[index % COLORS.length]}
                    fillOpacity={0.4}
                    stroke={COLORS[index % COLORS.length]}
                    strokeWidth={2}
                  />
                );
              })}
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}