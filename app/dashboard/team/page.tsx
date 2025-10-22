import { getTeamForUser, getUser } from '@/lib/db/queries';
import { Card, CardContent } from '@/components/ui/card';
import { TeamPageClient } from './team-page-client';

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  const teamData = await getTeamForUser();
  const currentUser = await getUser();

  // Find current user's role in the organization
  const currentUserMembership = teamData?.organizationMembers.find(
    (member) => member.user.id === currentUser?.id
  );
  const currentUserRole = currentUserMembership?.role;

  if (!teamData) {
    return (
      <div className="flex-1 space-y-6 p-8 pt-6">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold tracking-tight mb-2">Organization</h2>
          <p className="text-muted-foreground">Manage your organization settings</p>
        </div>
        <Card className="max-w-2xl mx-auto">
          <CardContent className="pt-6">
            <p className="text-muted-foreground">No organization found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-3xl font-bold tracking-tight mb-2">Organization</h2>
        <p className="text-muted-foreground">Manage your organization settings and team members</p>
      </div>

      <div className="max-w-2xl mx-auto">
        <TeamPageClient
          defaultTab={params.tab || 'members'}
          teamData={teamData}
          currentUserId={currentUser?.id}
          currentUserRole={currentUserRole}
        />
      </div>
    </div>
  );
}