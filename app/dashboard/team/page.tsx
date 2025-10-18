import { getTeamForUser } from '@/lib/db/queries';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { InviteTeamMember } from './invite-team-member';
import { TeamMembersList } from './team-members-list';

export default async function TeamPage() {
  const teamData = await getTeamForUser();

  if (!teamData) {
    return (
      <div className="flex-1 space-y-4 p-8 pt-6">
        <h2 className="text-3xl font-bold tracking-tight">Team</h2>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">No team found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Team</h2>
      </div>

      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>{teamData.name}</CardTitle>
            <CardDescription>
              Manage your team members and their roles
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TeamMembersList members={teamData.teamMembers} />
          </CardContent>
        </Card>

        <InviteTeamMember />
      </div>
    </div>
  );
}