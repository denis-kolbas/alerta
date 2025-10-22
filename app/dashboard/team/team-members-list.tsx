'use client';

import { useState } from 'react';
import { removeTeamMember } from '@/app/(login)/actions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { getInitials, getAvatarColor } from '@/lib/avatar-utils';
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
import { toast } from 'sonner';

type TeamMember = {
  id: number;
  role: string;
  user: {
    id: number;
    name: string | null;
    email: string;
  };
};

export function TeamMembersList({ 
  members = [], 
  currentUserId,
  currentUserRole,
}: { 
  members?: TeamMember[];
  currentUserId?: number;
  currentUserRole?: string;
}) {
  const [removeMemberId, setRemoveMemberId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const memberToRemove = members?.find(m => m.id === removeMemberId);

  async function handleRemove() {
    if (!removeMemberId) return;

    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append('memberId', removeMemberId.toString());
      const result = await removeTeamMember(formData);
      
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success('Team member removed successfully');
        setTimeout(() => {
          window.location.href = '/dashboard/team?tab=members';
        }, 100);
      }
    } catch (error) {
      console.error('Failed to remove member:', error);
      toast.error('Failed to remove team member');
    } finally {
      setIsLoading(false);
      setRemoveMemberId(null);
    }
  }

  const isCurrentUserOwner = currentUserRole === 'owner';

  if (!members || members.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No members found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {members.map((member) => {
        const isCurrentUser = member.user.id === currentUserId;
        const isMemberOwner = member.role === 'owner';
        const canRemove = isCurrentUserOwner && (!isCurrentUser || !isMemberOwner);

        return (
          <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className={`${getAvatarColor(member.user.email)}`}>
                  {getInitials(member.user.name, member.user.email)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">
                  {member.user.name || member.user.email}
                  {isCurrentUser && <span className="text-muted-foreground ml-2">(You)</span>}
                </p>
                <p className="text-sm text-muted-foreground">{member.user.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{member.role}</Badge>
              {isCurrentUserOwner && (
                canRemove ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-transparent border-2 border-muted-foreground/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    onClick={() => setRemoveMemberId(member.id)}
                  >
                    Remove
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled
                    className="bg-transparent border-2 border-muted-foreground/30 text-muted-foreground"
                    title="Team owners cannot remove themselves"
                  >
                    Remove
                  </Button>
                )
              )}
            </div>
          </div>
        );
      })}

      <AlertDialog open={removeMemberId !== null} onOpenChange={() => setRemoveMemberId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove team member?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{' '}
              <strong>{memberToRemove?.user.name || memberToRemove?.user.email}</strong> from the team?
              They will lose access to all team resources.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              disabled={isLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLoading ? 'Removing...' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}