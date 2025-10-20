'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { CollapsibleStepper } from '@/components/ui/collapsible-stepper';
import { saveBrazeIntegration } from '@/app/dashboard/integrations/braze/actions';
import { toast } from 'sonner';

interface BrazeIntegrationFormProps {
  existingData?: {
    brazeInstance: string;
    hasApiKey: boolean;
    isActive: boolean;
  } | null;
}

export function BrazeIntegrationForm({ existingData }: BrazeIntegrationFormProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isApiKeyFocused, setIsApiKeyFocused] = useState(false);
  const [formData, setFormData] = useState({
    brazeInstance: existingData?.brazeInstance || '',
    apiKey: '',
  });
  const [availableEvents, setAvailableEvents] = useState<string[]>([]);
  const [enabledEvents, setEnabledEvents] = useState<Set<string>>(new Set());

  const isConnected = existingData?.isActive && existingData?.hasApiKey;

  const handleCredentialsNext = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      // If editing existing connection and no new API key provided, use existing credentials
      const useExistingKey = isConnected && !formData.apiKey;
      
      // Validate credentials by fetching events via API route (avoids CORS)
      const response = await fetch('/api/integrations/braze/discover-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instanceUrl: formData.brazeInstance,
          apiKey: formData.apiKey,
          useExistingCredentials: useExistingKey
        })
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to connect to Braze');
        return;
      }

      if (!data.events || data.events.length === 0) {
        toast.error('No events found in your Braze account');
        return;
      }

      setAvailableEvents(data.events);
      setEnabledEvents(new Set(data.events)); // All enabled by default
      setCurrentStep(1);
      toast.success(`Found ${data.events.length} events`);
      
    } catch {
      toast.error('Failed to connect to Braze. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinalSubmit = async () => {
    setIsLoading(true);

    try {
      // Events that are NOT enabled are blacklisted
      const blacklistedEvents = availableEvents.filter(e => !enabledEvents.has(e));
      
      const result = await saveBrazeIntegration({
        ...formData,
        blacklistedEvents
      });
      
      if (result.success) {
        toast.success('Braze integration saved successfully');
        router.push('/dashboard/integrations');
      } else {
        toast.error(result.error || 'Failed to save integration');
      }
    } catch {
      toast.error('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };



  const steps = [
    {
      title: 'Credentials',
      description: 'Connect your Braze account',
      summary: formData.brazeInstance ? `Connected to ${formData.brazeInstance}` : undefined,
      content: (
        <form onSubmit={handleCredentialsNext} className="space-y-6" autoComplete="off">
          <input type="text" style={{ display: 'none' }} />
          <input type="password" style={{ display: 'none' }} />
          
          <div className="space-y-2">
            <Label htmlFor="brazeInstance">Braze Instance URL</Label>
            <Input
              id="brazeInstance"
              name="braze-instance-url"
              type="text"
              placeholder="rest.iad-07.braze.com"
              value={formData.brazeInstance}
              onChange={(e) => setFormData({ ...formData, brazeInstance: e.target.value })}
              autoComplete="off"
              data-form-type="other"
              required
            />
            <p className="text-sm text-muted-foreground">
              Enter your Braze instance URL (e.g., rest.iad-07.braze.com)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key</Label>
            <Input
              id="apiKey"
              name="braze-api-key-secret"
              type="password"
              placeholder={existingData?.hasApiKey ? "••••••••••••••••" : "Enter your Braze API key"}
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
            <p className="text-sm text-muted-foreground">
              {existingData?.hasApiKey 
                ? 'Leave blank to keep existing API key, or enter a new one to update' 
                : 'Your API key will be encrypted and stored securely'}
            </p>
          </div>

          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? 'Loading...' : 'Next'}
          </Button>
        </form>
      )
    },
    {
      title: 'Select Events',
      description: 'Choose which events to monitor',
      summary: enabledEvents.size > 0 ? `${enabledEvents.size} of ${availableEvents.length} events enabled` : undefined,
      content: (
        <div className="space-y-6">
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-muted/50 px-4 py-3 border-b">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Event Name</span>
                <span className="text-sm font-medium">Monitor</span>
              </div>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {availableEvents.map((event) => (
                <div
                  key={event}
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

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCurrentStep(0)}
              className="flex-1"
            >
              Back
            </Button>
            <Button
              type="button"
              onClick={handleFinalSubmit}
              disabled={isLoading || enabledEvents.size === 0}
              className="flex-1"
            >
              {isLoading ? 'Saving...' : (isConnected ? 'Save Changes' : 'Complete Setup')}
            </Button>
          </div>
        </div>
      )
    }
  ];

  return (
    <CollapsibleStepper 
      steps={steps} 
      currentStep={currentStep} 
      onStepChange={setCurrentStep}
    />
  );
}
