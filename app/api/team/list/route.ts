import { NextResponse } from 'next/server';
import { getUser, getUserTeamRole } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { teamMembers, teams } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const user = await getUser();
    
    if (!user) {
      return NextResponse.json({ teams: [], currentTeamId: null, currentUserRole: null });
    }

    // Get all teams the user is a member of with their role
    const userTeams = await db
      .select({
        id: teams.id,
        name: teams.name,
        planName: teams.planName,
        role: teamMembers.role,
      })
      .from(teamMembers)
      .innerJoin(teams, eq(teamMembers.teamId, teams.id))
      .where(eq(teamMembers.userId, user.id));

    // Get current team from cookie or default to first team
    const cookieStore = await cookies();
    const currentTeamCookie = cookieStore.get('current_team_id');
    let currentTeamId = currentTeamCookie ? parseInt(currentTeamCookie.value) : null;

    // If no current team set or invalid, use first team
    if (!currentTeamId || !userTeams.find(t => t.id === currentTeamId)) {
      currentTeamId = userTeams[0]?.id || null;
    }

    // Get current user's role in the current team
    const currentUserRole = currentTeamId 
      ? await getUserTeamRole(user.id, currentTeamId)
      : null;

    return NextResponse.json({
      teams: userTeams,
      currentTeamId,
      currentUserRole,
    });
  } catch (error) {
    console.error('Error fetching teams:', error);
    return NextResponse.json({ error: 'Failed to fetch teams' }, { status: 500 });
  }
}
