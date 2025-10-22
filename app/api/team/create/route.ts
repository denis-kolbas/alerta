import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { teams, activityLogs, ActivityType } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name } = await request.json();

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Workspace name is required' }, { status: 400 });
    }

    // Get user's organization and role
    const { organizationMembers } = await import('@/lib/db/schema');
    const userOrg = await db
      .select({ 
        organizationId: organizationMembers.organizationId,
        role: organizationMembers.role 
      })
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, user.id))
      .limit(1);

    if (!userOrg[0]) {
      return NextResponse.json({ error: 'User not in any organization' }, { status: 400 });
    }

    // Check if user is org owner or admin
    if (userOrg[0].role !== 'owner' && userOrg[0].role !== 'admin') {
      return NextResponse.json({ 
        error: 'Only organization owners and admins can create workspaces' 
      }, { status: 403 });
    }

    // Create the workspace
    const [newTeam] = await db
      .insert(teams)
      .values({ 
        name: name.trim(),
        organizationId: userOrg[0].organizationId
      })
      .returning();

    // User already has access via organization membership

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
