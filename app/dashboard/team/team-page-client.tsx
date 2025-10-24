'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InviteTeamMember } from './invite-team-member';
import { TeamMembersList } from './team-members-list';
import { WorkspacesList } from './workspaces-list';
import { BillingTab } from './billing-tab';

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
    planName: string | null;
    subscriptionStatus: string | null;
    subscriptionEndDate: Date | null;
    cancelAtPeriodEnd: boolean | null;
    billingInterval: string | null;
    billingAmount: number | null;
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
        <BillingTab
          currentPlan={teamData.organization?.planName || 'Free'}
          subscriptionStatus={teamData.organization?.subscriptionStatus ?? undefined}
          subscriptionEndDate={teamData.organization?.subscriptionEndDate ?? undefined}
          cancelAtPeriodEnd={teamData.organization?.cancelAtPeriodEnd ?? undefined}
          billingInterval={teamData.organization?.billingInterval ?? undefined}
          billingAmount={teamData.organization?.billingAmount ?? undefined}
          currentUserRole={currentUserRole}
        />
      </TabsContent>
    </Tabs>
  );
}
