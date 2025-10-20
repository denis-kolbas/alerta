'use client';

import { useState } from 'react';
import { updateAccount, updatePassword, updateNotificationPreferences } from '@/app/(login)/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Eye, EyeOff } from 'lucide-react';
import useSWR from 'swr';
import { toast } from 'sonner';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function AccountPage() {
  const { data: user } = useSWR('/api/user', fetcher);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [alertEmailPreference, setAlertEmailPreference] = useState('critical_only');
  
  const [isLoadingAccount, setIsLoadingAccount] = useState(false);
  const [isLoadingPassword, setIsLoadingPassword] = useState(false);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);

  // Initialize form when user data loads
  if (user && !name && !email) {
    setName(user.name || '');
    setEmail(user.email || '');
    setAlertEmailPreference(user.alertEmailPreference || 'critical_only');
  }

  async function handleAccountSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoadingAccount(true);

    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('email', email);

      const result = await updateAccount(formData);

      if (result && 'error' in result) {
        toast.error(result.error);
      } else if (result && 'success' in result) {
        toast.success(result.success);
      }
    } finally {
      setIsLoadingAccount(false);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoadingPassword(true);

    try {
      const formData = new FormData();
      formData.append('currentPassword', currentPassword);
      formData.append('newPassword', newPassword);
      formData.append('confirmPassword', confirmPassword);

      const result = await updatePassword(formData);

      if (result && 'error' in result) {
        toast.error(result.error);
      } else if (result && 'success' in result) {
        toast.success(result.success);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } finally {
      setIsLoadingPassword(false);
    }
  }

  async function handleNotificationSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoadingNotifications(true);

    try {
      const formData = new FormData();
      formData.append('alertEmailPreference', alertEmailPreference);

      const result = await updateNotificationPreferences(formData);

      if (result && 'error' in result) {
        toast.error(result.error);
      } else if (result && 'success' in result) {
        toast.success(result.success);
      }
    } finally {
      setIsLoadingNotifications(false);
    }
  }

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-3xl font-bold tracking-tight mb-2">Account Settings</h2>
        <p className="text-muted-foreground">Manage your account settings and preferences</p>
      </div>

      <div className="max-w-2xl mx-auto">
        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList>
            <TabsTrigger value="profile">Profile & Security</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-6">
            <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
          <CardDescription>Update your account details</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAccountSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={isLoadingAccount}>
                {isLoadingAccount ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>Update your password to keep your account secure</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={8}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={8}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={isLoadingPassword}>
                {isLoadingPassword ? 'Updating...' : 'Update Password'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
          </TabsContent>

          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>Choose when you want to receive email notifications for alerts</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleNotificationSubmit} className="space-y-4">
                  <RadioGroup value={alertEmailPreference} onValueChange={setAlertEmailPreference}>
                    <div className="flex items-center space-x-3 space-y-0 rounded-md border p-4">
                      <RadioGroupItem value="all" id="all" />
                      <div className="space-y-1 leading-none">
                        <Label htmlFor="all" className="font-medium cursor-pointer">
                          All Alerts
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Receive email notifications for all alerts, regardless of severity
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3 space-y-0 rounded-md border p-4">
                      <RadioGroupItem value="critical_only" id="critical_only" />
                      <div className="space-y-1 leading-none">
                        <Label htmlFor="critical_only" className="font-medium cursor-pointer">
                          Critical Alerts Only
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Only receive notifications for critical severity alerts
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3 space-y-0 rounded-md border p-4">
                      <RadioGroupItem value="none" id="none" />
                      <div className="space-y-1 leading-none">
                        <Label htmlFor="none" className="font-medium cursor-pointer">
                          No Email Alerts
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Don&apos;t send me any email notifications for alerts
                        </p>
                      </div>
                    </div>
                  </RadioGroup>
                  <p className="text-xs text-muted-foreground">
                    Note: Multiple alerts within 5 minutes will be grouped into a single email
                  </p>
                  <div className="flex justify-end">
                    <Button type="submit" disabled={isLoadingNotifications}>
                      {isLoadingNotifications ? 'Saving...' : 'Save Preferences'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
