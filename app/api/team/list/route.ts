import { NextResponse } from 'next/server';
import { getUser, getUserTeamRole } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { teams, organizationMembers, organizations } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const user = await getUser();
    
    if (!user) {
      return NextResponse.json({ 
        teams: [], 
        currentTeamId: null, 
        currentUserRole: null,
        organizationRole: null 
      });
    }

    // Get all teams the user has access to via organization membership
    const userTeams = await db
      .select({
        id: teams.id,
        name: teams.name,
        role: organizationMembers.role,
      })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
      .innerJoin(teams, eq(teams.organizationId, organizations.id))
      .where(eq(organizationMembers.userId, user.id));

    // Get current team from cookie or default to first team
    const cookieStore = await cookies();
    const currentTeamCookie = cookieStore.get('current_team_id');
    let currentTeamId = currentTeamCookie ? parseInt(currentTeamCookie.value) : null;

    // If no current team set or invalid, use first team
    if (!currentTeamId || !userTeams.find(t => t.id === currentTeamId)) {
      currentTeamId = userTeams[0]?.id || null;
    }

    // Get current user's role in the current workspace
    const currentUserRole = currentTeamId 
      ? await getUserTeamRole(user.id, currentTeamId)
      : null;

    // Organization role is already fetched above
    const organizationRole = userTeams[0]?.role || null;

    return NextResponse.json({
      teams: userTeams,
      currentTeamId,
      currentUserRole,
      organizationRole,
    });
  } catch (error) {
    console.error('Error fetching teams:', error);
    return NextResponse.json({ error: 'Failed to fetch teams' }, { status: 500 });
  }
}
