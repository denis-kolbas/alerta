import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { teams, organizationMembers, organizations } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { teamId } = await request.json();

    if (!teamId || typeof teamId !== 'number') {
      return NextResponse.json({ error: 'Invalid team ID' }, { status: 400 });
    }

    // Verify user has access to this team via organization membership
    const hasAccess = await db
      .select({ id: teams.id })
      .from(teams)
      .innerJoin(organizations, eq(teams.organizationId, organizations.id))
      .innerJoin(organizationMembers, eq(organizationMembers.organizationId, organizations.id))
      .where(eq(organizationMembers.userId, user.id))
      .limit(1);

    if (hasAccess.length === 0) {
      return NextResponse.json({ error: 'Not a member of this organization' }, { status: 403 });
    }

    // Set cookie for current team
    const cookieStore = await cookies();
    cookieStore.set('current_team_id', teamId.toString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365, // 1 year
    });

    return NextResponse.json({ success: true, teamId });
  } catch (error) {
    console.error('Error switching team:', error);
    return NextResponse.json({ error: 'Failed to switch team' }, { status: 500 });
  }
}
