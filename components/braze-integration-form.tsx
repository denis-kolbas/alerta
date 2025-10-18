'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { saveBrazeIntegration } from '@/app/dashboard/integrations/braze/actions';
import { toast } from 'sonner';

export function BrazeIntegrationForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isApiKeyFocused, setIsApiKeyFocused] = useState(false);
  const [formData, setFormData] = useState({
    brazeInstance: '',
    apiKey: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await saveBrazeIntegration(formData);
      
      if (result.success) {
        toast.success('Braze integration saved successfully');
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
          placeholder="Enter your Braze API key"
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
        <p className="text-sm text-muted-foreground">
          Your API key will be encrypted and stored securely
        </p>
      </div>

      <Button type="submit" disabled={isLoading} className="w-full">
        {isLoading ? 'Saving...' : 'Save Integration'}
      </Button>
    </form>
  );
}
