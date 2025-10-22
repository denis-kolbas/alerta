'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { getWorkspaceInitials, getAvatarColor } from '@/lib/avatar-utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface Team {
  id: number;
  name: string;
  role: string;
  planName?: string;
}

interface WorkspacesListProps {
  currentUserId?: number;
}

export function WorkspacesList({}: WorkspacesListProps) {
  const { data: teamsData, mutate } = useSWR('/api/team/list', fetcher);
  const [deleteTeamId, setDeleteTeamId] = useState<number | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const teams = teamsData?.teams || [];
  const currentTeamId = teamsData?.currentTeamId;
  const organizationRole = teamsData?.organizationRole;
  // Can create/delete workspaces if org owner or admin
  const canManageWorkspaces = organizationRole === 'owner' || organizationRole === 'admin';

  const handleDeleteTeam = async (teamId: number) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/team/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Workspace deleted successfully');
        setDeleteTeamId(null);
        
        // Refresh the list to show updated workspaces
        await mutate();
        
        // If deleted current team, redirect to stay on workspaces tab with new team
        if (teamId === currentTeamId) {
          setTimeout(() => {
            window.location.href = '/dashboard/team?tab=workspaces';
          }, 100);
        } else {
          setIsLoading(false);
        }
      } else {
        toast.error(data.error || 'Failed to delete workspace');
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Failed to delete team:', error);
      toast.error('Failed to delete workspace');
      setIsLoading(false);
    }
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newTeamName.trim()) {
      toast.error('Workspace name is required');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/team/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTeamName }),
      });

      if (response.ok) {
        toast.success('Workspace created successfully');
        setShowCreateDialog(false);
        setNewTeamName('');
        
        // Redirect to workspaces tab with new workspace
        setTimeout(() => {
          window.location.href = '/dashboard/team?tab=workspaces';
        }, 100);
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to create workspace');
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Failed to create team:', error);
      toast.error('Failed to create workspace');
      setIsLoading(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Your Workspaces</CardTitle>
              <CardDescription>
                Manage the workspaces you belong to
              </CardDescription>
            </div>
            {canManageWorkspaces && (
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                New Workspace
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {teams.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No workspaces found</p>
              </div>
            ) : (
              teams.map((team: Team) => (
                <div
                  key={team.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <Avatar className="h-10 w-10 rounded-lg">
                      <AvatarFallback className={`${getAvatarColor(team.name)} rounded-lg`}>
                        {getWorkspaceInitials(team.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{team.name}</h3>
                        {team.id === currentTeamId && (
                          <Badge variant="secondary">Current</Badge>
                        )}
                        <Badge variant="outline" className="capitalize">
                          {team.role}
                        </Badge>
                      </div>
                      {team.planName && (
                        <p className="text-sm text-muted-foreground">
                          {team.planName} plan
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {canManageWorkspaces && teams.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteTeamId(team.id)}
                        disabled={isLoading}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={deleteTeamId !== null} onOpenChange={() => setDeleteTeamId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete workspace?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the workspace
              and all associated data including integrations, events, and alerts.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTeamId && handleDeleteTeam(deleteTeamId)}
              disabled={isLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLoading ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <form onSubmit={handleCreateTeam}>
            <DialogHeader>
              <DialogTitle>Create a new workspace</DialogTitle>
              <DialogDescription>
                Add a new workspace to organize your team and integrations.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="workspace-name">Workspace name</Label>
              <Input
                id="workspace-name"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                placeholder="Acme Inc"
                className="mt-2"
                disabled={isLoading}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreateDialog(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Creating...' : 'Create workspace'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
