import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { teams, organizationMembers, organizations } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';

export async function DELETE(request: NextRequest) {
  try {
    const user = await getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { teamId } = await request.json();

    if (!teamId || typeof teamId !== 'number') {
      return NextResponse.json({ error: 'Invalid team ID' }, { status: 400 });
    }

    // Check if user is org owner or admin
    const userOrg = await db
      .select({ 
        role: organizationMembers.role,
        organizationId: organizationMembers.organizationId 
      })
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, user.id))
      .limit(1);

    if (!userOrg[0] || (userOrg[0].role !== 'owner' && userOrg[0].role !== 'admin')) {
      return NextResponse.json({ 
        error: 'Only organization owners and admins can delete workspaces' 
      }, { status: 403 });
    }

    // Check if user has other teams in their organization
    const userTeams = await db
      .select({ id: teams.id })
      .from(teams)
      .where(eq(teams.organizationId, userOrg[0].organizationId));

    if (userTeams.length <= 1) {
      return NextResponse.json({ 
        error: 'Cannot delete your only workspace' 
      }, { status: 400 });
    }

    // If this is the current team, switch to another team first
    const cookieStore = await cookies();
    const currentTeamCookie = cookieStore.get('current_team_id');
    
    if (currentTeamCookie && parseInt(currentTeamCookie.value) === teamId) {
      const otherTeam = userTeams.find(t => t.id !== teamId);
      if (otherTeam) {
        cookieStore.set('current_team_id', otherTeam.id.toString(), {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 365,
        });
      }
    }

    // Delete the team (cascade will handle team_members, clients, etc.)
    await db.delete(teams).where(eq(teams.id, teamId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting team:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete team';
    return NextResponse.json({ 
      error: 'Failed to delete team',
      details: errorMessage 
    }, { status: 500 });
  }
}
