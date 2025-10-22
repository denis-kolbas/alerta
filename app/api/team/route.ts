import { NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { teamMembers, teams } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const user = await getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all teams the user is a member of
    const userTeams = await db
      .select({
        id: teams.id,
        name: teams.name,
        role: teamMembers.role,
      })
      .from(teamMembers)
      .innerJoin(teams, eq(teamMembers.teamId, teams.id))
      .where(eq(teamMembers.userId, user.id));

    // Get current team from cookie
    const cookieStore = await cookies();
    const currentTeamCookie = cookieStore.get('current_team_id');
    const currentTeamId = currentTeamCookie ? parseInt(currentTeamCookie.value) : null;

    // If no current team is set, use the first team
    const activeTeamId = currentTeamId || userTeams[0]?.id || null;

    return NextResponse.json({
      teams: userTeams,
      currentTeamId: activeTeamId,
    });
  } catch (error) {
    console.error('Error fetching teams:', error);
    return NextResponse.json({ error: 'Failed to fetch teams' }, { status: 500 });
  }
}
