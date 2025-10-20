'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { acceptInvitation } from '@/app/invite/[token]/actions';
import { useRouter } from 'next/navigation';

export function AcceptInvitationForm({
  token,
  email,
  role,
}: {
  token: string;
  email: string;
  role: string;
}) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const formData = new FormData();
    formData.append('token', token);
    formData.append('name', name);
    formData.append('password', password);

    const result = await acceptInvitation(formData);

    if (result?.error) {
      setError(result.error);
      setIsLoading(false);
    } else {
      // Success - redirect to dashboard
      router.push('/dashboard');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={email}
          disabled
          className="bg-muted"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="role">Role</Label>
        <Input
          id="role"
          value={role}
          disabled
          className="bg-muted capitalize"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">Your Name</Label>
        <Input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="John Doe"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Create a password"
          required
          minLength={8}
        />
        <p className="text-xs text-muted-foreground">
          Must be at least 8 characters
        </p>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
          {error}
        </div>
      )}

      <Button
        type="submit"
        className="w-full"
        disabled={isLoading}
      >
        {isLoading ? 'Creating Account...' : 'Accept Invitation'}
      </Button>
      
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <a href="/sign-in" className="underline">
          Sign in
        </a>
      </p>
    </form>
  );
}
