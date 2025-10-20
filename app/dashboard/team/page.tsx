import { getTeamForUser, getUser } from '@/lib/db/queries';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InviteTeamMember } from './invite-team-member';
import { TeamMembersList } from './team-members-list';

export default async function TeamPage() {
  const teamData = await getTeamForUser();
  const currentUser = await getUser();

  // Find current user's role in the team
  const currentUserMembership = teamData?.teamMembers.find(
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
        <Tabs defaultValue="team" className="space-y-6">
          <TabsList>
            <TabsTrigger value="team">Team</TabsTrigger>
            <TabsTrigger value="billing">Plan & Billing</TabsTrigger>
          </TabsList>

          <TabsContent value="team" className="space-y-4">
            <InviteTeamMember />

            <Card>
              <CardHeader>
                <CardTitle>{teamData.name}</CardTitle>
                <CardDescription>
                  Manage your team members and their roles
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TeamMembersList 
                  members={teamData.teamMembers} 
                  currentUserId={currentUser?.id}
                  currentUserRole={currentUserRole}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="billing">
            <Card>
              <CardHeader>
                <CardTitle>Plan & Billing</CardTitle>
                <CardDescription>
                  Manage your subscription and billing information
                </CardDescription>
              </CardHeader>
              <CardContent className="py-12">
                <div className="text-center text-muted-foreground">
                  <p>Billing management coming soon</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}