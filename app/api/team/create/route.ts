import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { teams, teamMembers, activityLogs, ActivityType } from '@/lib/db/schema';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is an owner of at least one team
    const { isTeamOwner, getCurrentTeamId } = await import('@/lib/db/queries');
    const currentTeamId = await getCurrentTeamId();
    
    if (currentTeamId) {
      const userIsOwner = await isTeamOwner(user.id, currentTeamId);
      if (!userIsOwner) {
        return NextResponse.json({ 
          error: 'Only workspace owners can create new workspaces' 
        }, { status: 403 });
      }
    }
    // If no current team, user has no teams yet, so allow creation (first workspace)

    const { name } = await request.json();

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Team name is required' }, { status: 400 });
    }

    // Create the team
    const [newTeam] = await db
      .insert(teams)
      .values({ name: name.trim() })
      .returning();

    // Add user as owner
    await db.insert(teamMembers).values({
      userId: user.id,
      teamId: newTeam.id,
      role: 'owner',
    });

    // Log activity
    await db.insert(activityLogs).values({
      teamId: newTeam.id,
      userId: user.id,
      action: ActivityType.CREATE_TEAM,
    });

    // Set as current team
    const cookieStore = await cookies();
    cookieStore.set('current_team_id', newTeam.id.toString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365, // 1 year
    });

    return NextResponse.json({ 
      success: true, 
      team: {
        id: newTeam.id,
        name: newTeam.name,
      }
    });
  } catch (error) {
    console.error('Error creating team:', error);
    return NextResponse.json({ error: 'Failed to create team' }, { status: 500 });
  }
}
