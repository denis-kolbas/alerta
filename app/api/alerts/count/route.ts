import { NextResponse } from 'next/server';
import { getTeamForUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { alerts, clients } from '@/lib/db/schema';
import { eq, and, or, isNull } from 'drizzle-orm';

export async function GET() {
  try {
    const team = await getTeamForUser();
    if (!team) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Count active alerts (not resolved and not dismissed)
    // Join with clients to filter by team
    const activeAlerts = await db
      .select()
      .from(alerts)
      .innerJoin(clients, eq(alerts.clientId, clients.id))
      .where(
        and(
          eq(clients.teamId, team.id),
          or(
            isNull(alerts.status),
            eq(alerts.status, 'active')
          )
        )
      );

    return NextResponse.json({ count: activeAlerts.length });
  } catch (error) {
    console.error('Error fetching alert count:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
