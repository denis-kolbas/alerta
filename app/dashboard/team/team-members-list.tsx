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

export function TeamMembersList({ members }: { members: TeamMember[] }) {
  async function handleRemove(memberId: number) {
    if (!confirm('Are you sure you want to remove this team member?')) {
      return;
    }

    const formData = new FormData();
    formData.append('memberId', memberId.toString());
    await removeTeamMember(formData);
    window.location.reload();
  }

  return (
    <div className="space-y-4">
      {members.map((member) => (
        <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg">
          <div>
            <p className="font-medium">{member.user.name || member.user.email}</p>
            <p className="text-sm text-muted-foreground">{member.user.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{member.role}</Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleRemove(member.id)}
            >
              Remove
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}