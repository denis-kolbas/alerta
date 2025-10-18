'use client';

import { useState, useMemo } from 'react';
import { AnalyticsChart } from './analytics-chart';
import { AlertsTable } from './alerts-table';
import { IntegrationFilterCards } from './integration-filter-cards';

interface EventDataPoint {
  id: number;
  brand: string;
  eventName: string;
  timestamp: Date;
  count: number;
  integrationName?: string | null;
}

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

interface AnalyticsDashboardProps {
  eventData: EventDataPoint[];
  availableEvents: string[];
  availableBrands: string[];
  alerts: Alert[];
  activeIntegrations: string[];
}

export function AnalyticsDashboard({
  eventData,
  availableEvents,
  availableBrands,
  alerts,
  activeIntegrations,
}: AnalyticsDashboardProps) {
  const [selectedEvents, setSelectedEvents] = useState<string[]>(availableEvents.slice(0, 3));
  const [selectedIntegrations, setSelectedIntegrations] = useState<string[]>(activeIntegrations);

  // Calculate integration stats
  const integrationStats = useMemo(() => {
    return activeIntegrations.map(integration => {
      const integrationEvents = eventData.filter(
        e => (e.integrationName || 'unknown') === integration
      );
      const uniqueEvents = new Set(integrationEvents.map(e => e.eventName));
      
      const activeAlerts = alerts.filter(
        a => (a.integrationName || 'unknown') === integration && !a.isResolved
      );
      
      return {
        name: integration,
        eventCount: uniqueEvents.size,
        isActive: true,
        activeAlertCount: activeAlerts.length,
      };
    });
  }, [activeIntegrations, eventData, alerts]);

  const handleIntegrationToggle = (integration: string) => {
    setSelectedIntegrations(prev => {
      const newIntegrations = prev.includes(integration)
        ? prev.filter(i => i !== integration)
        : [...prev, integration];
      
      // Don't allow deselecting all
      if (newIntegrations.length === 0) return prev;
      
      // Clear selected events that don't belong to selected integrations
      setSelectedEvents(current => 
        current.filter(event => {
          const eventIntegration = event.split(':')[0].trim();
          return newIntegrations.includes(eventIntegration);
        })
      );
      
      return newIntegrations;
    });
  };

  // Filter alerts by selected integrations
  const filteredAlerts = useMemo(() => {
    return alerts.filter(alert => {
      const integration = alert.integrationName || 'unknown';
      return selectedIntegrations.includes(integration);
    });
  }, [alerts, selectedIntegrations]);

  const handleAlertClick = (eventName: string, integrationName: string) => {
    // Format as "integration: eventName"
    const formattedEvent = `${integrationName}: ${eventName}`;
    
    // Replace all selected events with just this one
    setSelectedEvents([formattedEvent]);
    
    // Make sure the integration is selected
    if (!selectedIntegrations.includes(integrationName)) {
      setSelectedIntegrations([...selectedIntegrations, integrationName]);
    }
    
    // Scroll to chart
    const chartElement = document.getElementById('analytics-chart');
    if (chartElement) {
      chartElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <>
      <IntegrationFilterCards
        integrations={integrationStats}
        selectedIntegrations={selectedIntegrations}
        onToggle={handleIntegrationToggle}
      />

      <div id="analytics-chart">
        <AnalyticsChart
          eventData={eventData}
          availableEvents={availableEvents}
          availableBrands={availableBrands}
          selectedEvents={selectedEvents}
          onSelectedEventsChange={setSelectedEvents}
          activeIntegrations={activeIntegrations}
          selectedIntegrations={selectedIntegrations}
          onSelectedIntegrationsChange={setSelectedIntegrations}
        />
      </div>

      <AlertsTable alerts={filteredAlerts} onAlertClick={handleAlertClick} />
    </>
  );
}
