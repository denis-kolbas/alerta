'use server';

import { z } from 'zod';
import { db } from '@/lib/db/drizzle';
import { users, invitations, teamMembers, activityLogs, ActivityType } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { hashPassword, setSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';

const acceptInvitationSchema = z.object({
  token: z.string(),
  name: z.string().min(1, 'Name is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export async function acceptInvitation(formData: FormData) {
  const rawData = {
    token: formData.get('token') as string,
    name: formData.get('name') as string,
    password: formData.get('password') as string,
  };

  const result = acceptInvitationSchema.safeParse(rawData);

  if (!result.success) {
    return { error: result.error.errors[0].message };
  }

  const { token, name, password } = result.data;

  // Find invitation
  const invitation = await db.query.invitations.findFirst({
    where: and(
      eq(invitations.token, token),
      eq(invitations.status, 'pending')
    ),
  });

  if (!invitation) {
    return { error: 'Invalid or expired invitation' };
  }

  // Check if invitation is expired (7 days)
  const invitedAt = new Date(invitation.invitedAt);
  const expiresAt = new Date(invitedAt.getTime() + 7 * 24 * 60 * 60 * 1000);
  if (new Date() > expiresAt) {
    return { error: 'This invitation has expired' };
  }

  // Check if user already exists
  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, invitation.email),
  });

  if (existingUser) {
    // User exists, just add them to the team
    const existingMembership = await db.query.teamMembers.findFirst({
      where: and(
        eq(teamMembers.userId, existingUser.id),
        eq(teamMembers.teamId, invitation.teamId)
      ),
    });

    if (existingMembership) {
      return { error: 'You are already a member of this team' };
    }

    // Add user to team
    await db.insert(teamMembers).values({
      userId: existingUser.id,
      teamId: invitation.teamId,
      role: invitation.role,
    });

    // Mark invitation as accepted
    await db
      .update(invitations)
      .set({ status: 'accepted' })
      .where(eq(invitations.id, invitation.id));

    // Log activity
    await db.insert(activityLogs).values({
      teamId: invitation.teamId,
      userId: existingUser.id,
      action: ActivityType.ACCEPT_INVITATION,
      ipAddress: '',
    });

    // Set session
    await setSession(existingUser);
    redirect('/dashboard');
  }

  // Create new user
  const passwordHash = await hashPassword(password);

  const [newUser] = await db
    .insert(users)
    .values({
      email: invitation.email,
      passwordHash,
      name,
    })
    .returning();

  // Add user to team
  await db.insert(teamMembers).values({
    userId: newUser.id,
    teamId: invitation.teamId,
    role: invitation.role,
  });

  // Mark invitation as accepted
  await db
    .update(invitations)
    .set({ status: 'accepted' })
    .where(eq(invitations.id, invitation.id));

  // Log activity
  await db.insert(activityLogs).values({
    teamId: invitation.teamId,
    userId: newUser.id,
    action: ActivityType.ACCEPT_INVITATION,
    ipAddress: '',
  });

  // Set session
  await setSession(newUser);
  redirect('/dashboard');
}
