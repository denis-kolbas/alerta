'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { saveKlaviyoIntegration } from '@/app/dashboard/integrations/klaviyo/actions';
import { toast } from 'sonner';
import { ExternalLink } from 'lucide-react';

export function KlaviyoIntegrationForm() {
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
      const result = await saveKlaviyoIntegration(formData);
      
      if (result.success) {
        toast.success('Klaviyo integration saved successfully');
        router.push('/dashboard/integrations');
      } else {
        toast.error(result.error || 'Failed to save integration');
      }
    } catch (error) {
      toast.error('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

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
          placeholder="pk_..."
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
          required
        />
        <div className="flex items-start gap-2 text-sm text-muted-foreground">
          <div className="flex-1">
            <p>Your API key will be encrypted and stored securely.</p>
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
        {isLoading ? 'Saving...' : 'Save Integration'}
      </Button>
    </form>
  );
}
