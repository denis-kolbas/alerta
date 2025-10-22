'use client';

import { useState } from 'react';
import { Check, ChevronsUpDown, Plus, Building2 } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { getWorkspaceInitials, getAvatarColor } from '@/lib/avatar-utils';
import { useSidebar } from '@/components/ui/sidebar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Team {
  id: number;
  name: string;
  role?: string;
}

interface TeamSwitcherProps {
  teams: Team[];
  currentTeamId: number | null;
  currentUserRole: string | null;
  onTeamChange?: (teamId: number) => void;
}

export function TeamSwitcher({ teams, currentTeamId, currentUserRole, onTeamChange }: TeamSwitcherProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const currentTeam = teams.find(t => t.id === currentTeamId);
  const isOwner = currentUserRole === 'owner';
  const { state } = useSidebar();

  const handleTeamSwitch = async (teamId: number) => {
    if (teamId === currentTeamId) return;
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/team/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId }),
      });

      if (response.ok) {
        onTeamChange?.(teamId);
        
        // Redirect to dashboard with new team
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 100);
      } else {
        toast.error('Failed to switch team');
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Failed to switch team:', error);
      toast.error('Failed to switch team');
      setIsLoading(false);
    }
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newTeamName.trim()) {
      toast.error('Team name is required');
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
        toast.success('Team created successfully');
        setShowCreateDialog(false);
        setNewTeamName('');
        
        // Redirect to dashboard with new team
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 100);
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to create team');
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Failed to create team:', error);
      toast.error('Failed to create team');
      setIsLoading(false);
    }
  };

  if (teams.length === 0) {
    return null;
  }

  return (
    <>
      <DropdownMenu>
        <TooltipProvider>
          <Tooltip>
            <DropdownMenuTrigger asChild>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className={state === 'collapsed' ? 'h-8 w-8 p-0' : 'w-full justify-start gap-2'}
                  disabled={isLoading}
                >
                  <Avatar className="h-6 w-6 rounded-md">
                    <AvatarFallback className={`${getAvatarColor(currentTeam?.name || '')} text-xs rounded-md`}>
                      {currentTeam ? getWorkspaceInitials(currentTeam.name) : <Building2 className="h-3 w-3" />}
                    </AvatarFallback>
                  </Avatar>
                  {state === 'expanded' && (
                    <>
                      <span className="truncate flex-1 text-left">
                        {currentTeam?.name || 'Select team'}
                      </span>
                      <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
                    </>
                  )}
                </Button>
              </TooltipTrigger>
            </DropdownMenuTrigger>
            {state === 'collapsed' && (
              <TooltipContent side="right">
                {currentTeam?.name || 'Select team'}
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
        <DropdownMenuContent className="w-56" align="start">
          <DropdownMenuLabel>Teams</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {teams.map((team) => (
            <DropdownMenuItem
              key={team.id}
              onSelect={() => handleTeamSwitch(team.id)}
              className="cursor-pointer"
            >
              <Avatar className="h-6 w-6 mr-2 rounded-md">
                <AvatarFallback className={`${getAvatarColor(team.name)} text-xs rounded-md`}>
                  {getWorkspaceInitials(team.name)}
                </AvatarFallback>
              </Avatar>
              <span className="flex-1">{team.name}</span>
              <Check
                className={cn(
                  'h-4 w-4',
                  currentTeamId === team.id ? 'opacity-100' : 'opacity-0'
                )}
              />
            </DropdownMenuItem>
          ))}
          {isOwner && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="cursor-pointer"
                onSelect={() => setShowCreateDialog(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create team
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <form onSubmit={handleCreateTeam}>
            <DialogHeader>
              <DialogTitle>Create a new team</DialogTitle>
              <DialogDescription>
                Add a new team to collaborate with others.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="team-name">Team name</Label>
              <Input
                id="team-name"
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
                {isLoading ? 'Creating...' : 'Create team'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
