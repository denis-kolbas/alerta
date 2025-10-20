'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { saveKlaviyoIntegration } from '@/app/dashboard/integrations/klaviyo/actions';
import { toast } from 'sonner';
import { ExternalLink } from 'lucide-react';

interface KlaviyoIntegrationFormProps {
  existingData?: {
    hasApiKey: boolean;
    isActive: boolean;
    blacklistedEvents?: string[];
  } | null;
}

export function KlaviyoIntegrationForm({ existingData }: KlaviyoIntegrationFormProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('configuration');
  const [isLoading, setIsLoading] = useState(false);
  const [isApiKeyFocused, setIsApiKeyFocused] = useState(false);
  const [formData, setFormData] = useState({
    apiKey: '',
  });
  const [availableEvents, setAvailableEvents] = useState<string[]>([]);
  const [enabledEvents, setEnabledEvents] = useState<Set<string>>(new Set());
  const [showEventsTab, setShowEventsTab] = useState(false);

  const isConnected = existingData?.isActive && existingData?.hasApiKey;

  // If already connected, show events tab and default to it
  useEffect(() => {
    if (isConnected) {
      setShowEventsTab(true);
      setActiveTab('events');
      // Fetch events for existing connection
      fetchEvents();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected]);

  const fetchEvents = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/integrations/klaviyo/discover-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: formData.apiKey,
          useExistingCredentials: isConnected && !formData.apiKey
        })
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to fetch events');
        return false;
      }

      if (!data.events || data.events.length === 0) {
        toast.error('No events found in your Klaviyo account');
        return false;
      }

      // Deduplicate events (Klaviyo may return duplicates)
      const uniqueEvents = Array.from(new Set(data.events as string[]));
      setAvailableEvents(uniqueEvents);
      
      // Set enabled events: all events minus blacklisted ones
      const blacklisted = existingData?.blacklistedEvents || [];
      const enabled = uniqueEvents.filter((event) => !blacklisted.includes(event));
      setEnabledEvents(new Set(enabled));
      
      return true;
    } catch {
      toast.error('Failed to connect to Klaviyo');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // First validate by fetching events
      const eventsOk = await fetchEvents();
      
      if (!eventsOk) {
        setIsLoading(false);
        return;
      }

      // Save credentials to database
      const result = await saveKlaviyoIntegration({
        apiKey: formData.apiKey,
      });

      if (result.success) {
        toast.success('Credentials saved successfully');
        setShowEventsTab(true);
        setActiveTab('events');
        router.refresh();
      } else {
        toast.error(result.error || 'Failed to save credentials');
      }
    } catch {
      toast.error('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveBlacklist = async () => {
    setIsLoading(true);

    try {
      const blacklistedEvents = availableEvents.filter(e => !enabledEvents.has(e));
      
      const result = await saveKlaviyoIntegration({
        apiKey: formData.apiKey,
        blacklistedEvents
      });

      if (result.success) {
        toast.success('Event settings saved successfully');
        router.refresh();
      } else {
        toast.error(result.error || 'Failed to save settings');
      }
    } catch {
      toast.error('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
      <TabsList>
        <TabsTrigger value="configuration">Configuration</TabsTrigger>
        {showEventsTab && (
          <TabsTrigger value="events">Events</TabsTrigger>
        )}
      </TabsList>

      <TabsContent value="configuration">
        <Card>
          <CardHeader>
            <CardTitle>API Credentials</CardTitle>
            <CardDescription>
              {isConnected 
                ? 'Update your Klaviyo Private API Key' 
                : 'Enter your Klaviyo Private API Key to establish the connection'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveCredentials} className="space-y-6" autoComplete="off">
              <input type="text" style={{ display: 'none' }} />
              <input type="password" style={{ display: 'none' }} />
              
              <div className="space-y-2">
                <Label htmlFor="apiKey">Private API Key</Label>
                <Input
                  id="apiKey"
                  name="klaviyo-api-key-secret"
                  type="password"
                  placeholder={existingData?.hasApiKey ? "••••••••••••••••" : "pk_..."}
                  value={formData.apiKey}
                  onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                  onFocus={(e) => {
                    setIsApiKeyFocused(true);
                    e.target.removeAttribute('readonly');
                  }}
                  onBlur={() => setIsApiKeyFocused(false)}
                  autoComplete="new-password"
                  data-form-type="other"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  readOnly={!isApiKeyFocused}
                  required={!existingData?.hasApiKey}
                />
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <div className="flex-1">
                    <p>{existingData?.hasApiKey 
                      ? "Leave blank to keep existing API key, or enter a new one to update" 
                      : "Your API key will be encrypted and stored securely."}</p>
                    <p className="mt-1">
                      Required scopes: <code className="text-xs bg-muted px-1 py-0.5 rounded">events:read</code>, <code className="text-xs bg-muted px-1 py-0.5 rounded">metrics:read</code>
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-auto p-1"
                    asChild
                  >
                    <a
                      href="https://www.klaviyo.com/settings/account/api-keys"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </div>

              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? 'Saving...' : (isConnected ? 'Update Credentials' : 'Save & Continue')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </TabsContent>

      {showEventsTab && (
        <TabsContent value="events">
          <Card>
            <CardHeader>
              <CardTitle>Event Monitoring</CardTitle>
              <CardDescription>
                Choose which events to monitor for anomalies. Disabled events will not trigger alerts.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {isLoading && availableEvents.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-sm text-muted-foreground">Loading events...</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-muted/50 px-4 py-3 border-b">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Event Name</span>
                        <span className="text-sm font-medium">Monitor</span>
                      </div>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {availableEvents.map((event, index) => (
                        <div
                          key={`${event}-${index}`}
                          className="flex items-center justify-between px-4 py-3 border-b last:border-b-0 hover:bg-muted/30 transition-colors"
                        >
                          <span className="text-sm">{event}</span>
                          <Switch
                            checked={enabledEvents.has(event)}
                            onCheckedChange={(checked) => {
                              const newSet = new Set(enabledEvents);
                              if (checked) {
                                newSet.add(event);
                              } else {
                                newSet.delete(event);
                              }
                              setEnabledEvents(newSet);
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {enabledEvents.size} of {availableEvents.length} events enabled
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setEnabledEvents(new Set(availableEvents))}
                    >
                      Enable All
                    </Button>
                  </div>

                  <Button
                    onClick={handleSaveBlacklist}
                    disabled={isLoading || enabledEvents.size === 0}
                    className="w-full"
                  >
                    {isLoading ? 'Saving...' : 'Save Event Settings'}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      )}
    </Tabs>
  );
}
