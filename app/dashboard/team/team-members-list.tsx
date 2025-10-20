'use client';

import { removeTeamMember } from '@/app/(login)/actions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

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
  members, 
  currentUserId,
  currentUserRole,
}: { 
  members: TeamMember[];
  currentUserId?: number;
  currentUserRole?: string;
}) {
  async function handleRemove(memberId: number) {
    if (!confirm('Are you sure you want to remove this team member?')) {
      return;
    }

    const formData = new FormData();
    formData.append('memberId', memberId.toString());
    await removeTeamMember(formData);
    window.location.reload();
  }

  const isCurrentUserOwner = currentUserRole === 'owner';

  return (
    <div className="space-y-4">
      {members.map((member) => {
        const isCurrentUser = member.user.id === currentUserId;
        const isMemberOwner = member.role === 'owner';
        const canRemove = isCurrentUserOwner && (!isCurrentUser || !isMemberOwner);

        return (
          <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <p className="font-medium">
                {member.user.name || member.user.email}
                {isCurrentUser && <span className="text-muted-foreground ml-2">(You)</span>}
              </p>
              <p className="text-sm text-muted-foreground">{member.user.email}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{member.role}</Badge>
              {isCurrentUserOwner && (
                canRemove ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-transparent border-2 border-muted-foreground/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    onClick={() => handleRemove(member.id)}
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
    </div>
  );
}