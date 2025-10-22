'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InviteTeamMember } from './invite-team-member';
import { TeamMembersList } from './team-members-list';
import { WorkspacesList } from './workspaces-list';

interface TeamMember {
  id: number;
  role: string;
  user: {
    id: number;
    name: string | null;
    email: string;
  };
}

interface TeamData {
  name: string;
  organization: {
    id: number;
    name: string;
  };
  organizationMembers: TeamMember[];
}

interface TeamPageClientProps {
  defaultTab: string;
  teamData: TeamData;
  currentUserId?: number;
  currentUserRole?: string;
}

export function TeamPageClient({
  defaultTab,
  teamData,
  currentUserId,
  currentUserRole,
}: TeamPageClientProps) {
  return (
    <Tabs defaultValue={defaultTab} className="space-y-6">
      <TabsList>
        <TabsTrigger value="members">Team Members</TabsTrigger>
        <TabsTrigger value="workspaces">Workspaces</TabsTrigger>
        <TabsTrigger value="billing">Plan & Billing</TabsTrigger>
      </TabsList>

      <TabsContent value="members" className="space-y-4">
        <InviteTeamMember />

        <Card>
          <CardHeader>
            <CardTitle>{teamData.organization.name}</CardTitle>
            <CardDescription>
              Manage your organization members and their roles
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TeamMembersList
              members={teamData.organizationMembers || []}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
            />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="workspaces">
        <WorkspacesList currentUserId={currentUserId} />
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
  );
}
