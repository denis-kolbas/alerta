'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { saveKlaviyoIntegration } from '@/app/dashboard/integrations/klaviyo/actions';
import { toast } from 'sonner';
import { ExternalLink } from 'lucide-react';

interface KlaviyoIntegrationFormProps {
  existingData?: {
    hasApiKey: boolean;
    isActive: boolean;
  } | null;
}

export function KlaviyoIntegrationForm({ existingData }: KlaviyoIntegrationFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isApiKeyFocused, setIsApiKeyFocused] = useState(false);
  const [formData, setFormData] = useState({
    apiKey: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // First validate the API key
      const useExistingKey = isConnected && !formData.apiKey;
      
      const validateResponse = await fetch('/api/integrations/klaviyo/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: formData.apiKey,
          useExistingCredentials: useExistingKey
        })
      });

      const validateData = await validateResponse.json();

      if (!validateResponse.ok) {
        toast.error(validateData.error || 'Failed to validate API key');
        setIsLoading(false);
        return;
      }

      // If validation successful, save the integration
      const result = await saveKlaviyoIntegration(formData);
      
      if (result.success) {
        toast.success('Klaviyo integration saved successfully');
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

  const isConnected = existingData?.isActive && existingData?.hasApiKey;

  return (
    <form onSubmit={handleSubmit} className="space-y-6" autoComplete="off">
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
        {isLoading ? 'Saving...' : (isConnected ? 'Save' : 'Connect')}
      </Button>
    </form>
  );
}
