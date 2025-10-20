import { db } from '@/lib/db/drizzle';
import { invitations, teams } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

import Link from 'next/link';
import { AcceptInvitationForm } from './accept-invitation-form';

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // Find invitation
  const invitation = await db.query.invitations.findFirst({
    where: and(
      eq(invitations.token, token),
      eq(invitations.status, 'pending')
    ),
    with: {
      team: true,
      invitedBy: {
        columns: {
          name: true,
          email: true,
        },
      },
    },
  });

  if (!invitation) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invalid Invitation</CardTitle>
            <CardDescription>
              This invitation link is invalid or has already been used.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/sign-in">Go to Sign In</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if invitation is expired (7 days)
  const invitedAt = new Date(invitation.invitedAt);
  const expiresAt = new Date(invitedAt.getTime() + 7 * 24 * 60 * 60 * 1000);
  const isExpired = new Date() > expiresAt;

  if (isExpired) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invitation Expired</CardTitle>
            <CardDescription>
              This invitation has expired. Please ask the team owner to send a new invitation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/sign-in">Go to Sign In</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Accept Invitation</CardTitle>
          <CardDescription>
            {invitation.invitedBy.name || invitation.invitedBy.email} has invited you to join{' '}
            <strong>{invitation.team.name}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AcceptInvitationForm
            token={token}
            email={invitation.email}
            role={invitation.role}
          />
        </CardContent>
      </Card>
    </div>
  );
}
