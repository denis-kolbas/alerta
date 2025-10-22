import { NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { organizationMembers, organizations, teams } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const user = await getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all teams the user has access to via organization membership
    const userTeams = await db
      .select({
        id: teams.id,
        name: teams.name,
        role: organizationMembers.role,
        organizationId: organizations.id,
        organizationName: organizations.name,
      })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
      .innerJoin(teams, eq(teams.organizationId, organizations.id))
      .where(eq(organizationMembers.userId, user.id));

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
