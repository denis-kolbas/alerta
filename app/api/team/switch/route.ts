import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { teamMembers } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
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

    // Verify user is a member of this team
    const membership = await db
      .select()
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.userId, user.id),
          eq(teamMembers.teamId, teamId)
        )
      )
      .limit(1);

    if (membership.length === 0) {
      return NextResponse.json({ error: 'Not a member of this team' }, { status: 403 });
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
