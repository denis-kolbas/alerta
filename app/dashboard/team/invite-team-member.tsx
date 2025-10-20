'use client';

import { useState } from 'react';
import { inviteTeamMember } from '@/app/(login)/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

export function InviteTeamMember() {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'member' | 'owner'>('member');
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append('email', email);
      formData.append('role', role);

      const result = await inviteTeamMember(formData);

      if (result?.error) {
        toast.error(result.error);
      } else if (result?.success) {
        toast.success(result.success);
        setEmail('');
        setRole('member');
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite Team Member</CardTitle>
        <CardDescription>Send an invitation to join your team</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="space-y-2 flex-1">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@example.com"
                required
              />
            </div>
            <div className="space-y-2 md:w-[200px]">
              <Label htmlFor="role">Role</Label>
              <Select value={role} onValueChange={(value: 'member' | 'owner') => setRole(value)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="owner">Owner</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Sending...' : 'Send Invitation'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}