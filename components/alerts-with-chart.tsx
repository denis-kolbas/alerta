'use client';

import { useState } from 'react';
import { AlertsTable } from './alerts-table';
import { AlertEventChart } from './alert-event-chart';

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

interface AlertsWithChartProps {
  alerts: Alert[];
}

export function AlertsWithChart({ alerts }: AlertsWithChartProps) {
  const [selectedEvent, setSelectedEvent] = useState<{
    eventName: string;
    integrationName: string;
  } | null>(null);
  const [eventData, setEventData] = useState<EventDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);

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

  return (
    <div className="space-y-6">
      <AlertsTable alerts={alerts} onAlertClick={handleAlertClick} />
      
      {selectedEvent && (
        <div>
          {isLoading ? (
            <div className="flex items-center justify-center h-64 border rounded-lg bg-background">
              <p className="text-muted-foreground">Loading event data...</p>
            </div>
          ) : (
            <AlertEventChart
              eventName={selectedEvent.eventName}
              integrationName={selectedEvent.integrationName}
              eventData={eventData}
            />
          )}
        </div>
      )}
    </div>
  );
}
