'use server';

import { z } from 'zod';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import {
  User,
  users,
  teams,
  organizations,
  organizationMembers,
  activityLogs,
  invitations,
  type NewUser,
  type NewOrganization,
  type NewOrganizationMember,
  type NewActivityLog,
  ActivityType
} from '@/lib/db/schema';
import { comparePasswords, hashPassword, setSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getUser, getUserWithTeam } from '@/lib/db/queries';
import {
  validatedAction,
  validatedActionWithUser
} from '@/lib/auth/middleware';
import { sendTeamInvitationEmail } from '@/lib/email';
import crypto from 'crypto';

async function logActivity(
  teamId: number | null | undefined,
  userId: number,
  type: ActivityType,
  ipAddress?: string
) {
  if (teamId === null || teamId === undefined) {
    return;
  }
  const newActivity: NewActivityLog = {
    teamId,
    userId,
    action: type,
    ipAddress: ipAddress || ''
  };
  await db.insert(activityLogs).values(newActivity);
}

const signInSchema = z.object({
  email: z.string().email('Please enter a valid email address').min(3).max(255),
  password: z.string().min(8, 'Password must be at least 8 characters').max(100)
});

export const signIn = validatedAction(signInSchema, async (data, formData) => {
  const { email, password } = data;

  console.log('Sign in attempt for:', email);

  // Just get the user - no need to join teams
  const foundUsers = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (foundUsers.length === 0) {
    console.log('User not found');
    return { error: 'Invalid email or password. Please try again.' };
  }

  const foundUser = foundUsers[0];

  const isPasswordValid = await comparePasswords(
    password,
    foundUser.passwordHash
  );

  console.log('Password valid:', isPasswordValid);

  if (!isPasswordValid) {
    return { error: 'Invalid email or password. Please try again.' };
  }

  await setSession(foundUser);
  
  // Log activity to user's first workspace (if they have one)
  const userWorkspace = await db
    .select({ teamId: teams.id })
    .from(organizationMembers)
    .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
    .innerJoin(teams, eq(teams.organizationId, organizations.id))
    .where(eq(organizationMembers.userId, foundUser.id))
    .limit(1);

  if (userWorkspace[0]) {
    await logActivity(userWorkspace[0].teamId, foundUser.id, ActivityType.SIGN_IN);
  }

  redirect('/dashboard');
});

const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  organizationName: z.string().min(1, 'Organization name is required')
});

export const signUp = validatedAction(signUpSchema, async (data) => {
  const { email, password, organizationName } = data;

  const existingUser = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existingUser.length > 0) {
    return { error: 'Failed to create user. Please try again.' };
  }

  const passwordHash = await hashPassword(password);

  const newUser: NewUser = {
    email,
    passwordHash,
    role: 'owner'
  };

  const [createdUser] = await db.insert(users).values(newUser).returning();

  if (!createdUser) {
    return { error: 'Failed to create user. Please try again.' };
  }

  // Create organization
  const { organizations, organizationMembers } = await import('@/lib/db/schema');
  const [createdOrg] = await db.insert(organizations).values({
    name: organizationName
  }).returning();

  if (!createdOrg) {
    return { error: 'Failed to create organization. Please try again.' };
  }

  // Add user as organization owner
  await db.insert(organizationMembers).values({
    userId: createdUser.id,
    organizationId: createdOrg.id,
    role: 'owner'
  });

  // Create first workspace
  const [createdTeam] = await db.insert(teams).values({
    name: `${organizationName} Workspace`,
    organizationId: createdOrg.id
  }).returning();

  if (!createdTeam) {
    return { error: 'Failed to create workspace. Please try again.' };
  }

  await Promise.all([
    logActivity(createdTeam.id, createdUser.id, ActivityType.SIGN_UP),
    setSession(createdUser)
  ]);

  redirect('/dashboard');
});

export async function signOut() {
  const user = await getUser();
  
  if (user) {
    const userWithTeam = await getUserWithTeam(user.id);
    await logActivity(userWithTeam?.teamId, user.id, ActivityType.SIGN_OUT);
  }
  
  (await cookies()).delete('session');
  redirect('/sign-in');
}

const updatePasswordSchema = z.object({
  currentPassword: z.string().min(8).max(100),
  newPassword: z.string().min(8).max(100),
  confirmPassword: z.string().min(8).max(100)
});

export const updatePassword = validatedActionWithUser(
  updatePasswordSchema,
  async (data, _, user) => {
    const { currentPassword, newPassword, confirmPassword } = data;

    const isPasswordValid = await comparePasswords(
      currentPassword,
      user.passwordHash
    );

    if (!isPasswordValid) {
      return { error: 'Current password is incorrect.' };
    }

    if (currentPassword === newPassword) {
      return { error: 'New password must be different from the current password.' };
    }

    if (confirmPassword !== newPassword) {
      return { error: 'New password and confirmation password do not match.' };
    }

    const newPasswordHash = await hashPassword(newPassword);
    const userWithTeam = await getUserWithTeam(user.id);

    await Promise.all([
      db
        .update(users)
        .set({ passwordHash: newPasswordHash })
        .where(eq(users.id, user.id)),
      logActivity(userWithTeam?.teamId, user.id, ActivityType.UPDATE_PASSWORD)
    ]);

    return { success: 'Password updated successfully.' };
  }
);

const updateAccountSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email address')
});

export const updateAccount = validatedActionWithUser(
  updateAccountSchema,
  async (data, _, user) => {
    const { name, email } = data;
    const userWithTeam = await getUserWithTeam(user.id);

    await Promise.all([
      db.update(users).set({ name, email }).where(eq(users.id, user.id)),
      logActivity(userWithTeam?.teamId, user.id, ActivityType.UPDATE_ACCOUNT)
    ]);

    return { success: 'Account updated successfully.' };
  }
);

const updateNotificationPreferencesSchema = z.object({
  alertEmailPreference: z.enum(['all', 'critical_only', 'none'])
});

export const updateNotificationPreferences = validatedActionWithUser(
  updateNotificationPreferencesSchema,
  async (data, _, user) => {
    const { alertEmailPreference } = data;

    await db
      .update(users)
      .set({ alertEmailPreference })
      .where(eq(users.id, user.id));

    return { success: 'Notification preferences updated successfully.' };
  }
);

const removeTeamMemberSchema = z.object({
  memberId: z.coerce.number()
});

export const removeTeamMember = validatedActionWithUser(
  removeTeamMemberSchema,
  async (data, _, user) => {
    const { memberId } = data;
    const userWithTeam = await getUserWithTeam(user.id);

    if (!userWithTeam?.teamId) {
      return { error: 'User is not part of a team' };
    }

    // Check if user is org owner/admin
    const { organizationMembers, teams: teamsTable } = await import('@/lib/db/schema');
    
    // Get the organization ID from the team
    const team = await db.select({ organizationId: teamsTable.organizationId })
      .from(teamsTable)
      .where(eq(teamsTable.id, userWithTeam.teamId))
      .limit(1);

    if (!team[0]) {
      return { error: 'Team not found' };
    }

    const orgRole = await db.select({ role: organizationMembers.role })
      .from(organizationMembers)
      .where(and(
        eq(organizationMembers.userId, user.id),
        eq(organizationMembers.organizationId, team[0].organizationId)
      ))
      .limit(1);

    const isOrgOwnerOrAdmin = orgRole[0]?.role === 'owner' || orgRole[0]?.role === 'admin';
    
    if (!isOrgOwnerOrAdmin) {
      return { error: 'Only organization owners or admins can remove members' };
    }

    // Get the member to remove
    const memberToRemove = await db.select({ userId: organizationMembers.userId })
      .from(organizationMembers)
      .where(eq(organizationMembers.id, memberId))
      .limit(1);

    if (!memberToRemove[0]) {
      return { error: 'Member not found' };
    }

    // Remove from organization (this will cascade to team_members)
    await db
      .delete(organizationMembers)
      .where(eq(organizationMembers.id, memberId));

    await logActivity(
      userWithTeam.teamId,
      user.id,
      ActivityType.REMOVE_TEAM_MEMBER
    );

    return { success: 'Organization member removed successfully' };
  }
);

const inviteTeamMemberSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['member', 'admin'])
});

export const inviteTeamMember = validatedActionWithUser(
  inviteTeamMemberSchema,
  async (data, _, user) => {
    const { email, role } = data;

    // Get user's organization
    const { organizationMembers, organizations } = await import('@/lib/db/schema');
    const userOrg = await db
      .select({ 
        organizationId: organizationMembers.organizationId,
        role: organizationMembers.role 
      })
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, user.id))
      .limit(1);

    if (!userOrg[0]) {
      return { error: 'User is not part of an organization' };
    }

    // Check if user is org owner or admin
    if (userOrg[0].role !== 'owner' && userOrg[0].role !== 'admin') {
      return { error: 'Only organization owners and admins can invite members' };
    }

    // Check if user already in organization
    const existingMember = await db
      .select()
      .from(organizationMembers)
      .innerJoin(users, eq(organizationMembers.userId, users.id))
      .where(
        and(
          eq(users.email, email),
          eq(organizationMembers.organizationId, userOrg[0].organizationId)
        )
      )
      .limit(1);

    if (existingMember.length > 0) {
      return { error: 'User is already a member of this organization' };
    }

    // Check for existing pending invitation
    const existingInvitation = await db
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.email, email),
          eq(invitations.organizationId, userOrg[0].organizationId),
          eq(invitations.status, 'pending')
        )
      )
      .limit(1);

    if (existingInvitation.length > 0) {
      return { error: 'An invitation has already been sent to this email' };
    }

    // Generate unique token
    const token = crypto.randomBytes(32).toString('hex');

    // Get organization info
    const organization = await db.query.organizations.findFirst({
      where: eq(organizations.id, userOrg[0].organizationId),
    });

    // Create invitation
    const [invitation] = await db
      .insert(invitations)
      .values({
        organizationId: userOrg[0].organizationId,
        email,
        role,
        invitedBy: user.id,
        token,
        status: 'pending',
      })
      .returning();

    // Send invitation email
    const invitationUrl = `${process.env.BASE_URL}/invite/${token}`;
    const emailResult = await sendTeamInvitationEmail({
      to: email,
      inviterName: user.name || user.email,
      teamName: organization?.name || 'the organization',
      invitationUrl,
    });

    if (emailResult.error) {
      // Rollback invitation if email fails
      await db.delete(invitations).where(eq(invitations.id, invitation.id));
      return { error: 'Failed to send invitation email. Please try again.' };
    }

    // Log activity (use first workspace for activity log)
    const firstWorkspace = await db
      .select({ id: teams.id })
      .from(teams)
      .where(eq(teams.organizationId, userOrg[0].organizationId))
      .limit(1);

    if (firstWorkspace[0]) {
      await logActivity(
        firstWorkspace[0].id,
        user.id,
        ActivityType.INVITE_TEAM_MEMBER
      );
    }

    return { success: 'Invitation sent successfully' };
  }
);