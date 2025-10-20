import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { eventData } from '@/lib/db/schema';
import { and, eq, gte, sql } from 'drizzle-orm';
import { getUser } from '@/lib/db/queries';

export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const eventName = searchParams.get('eventName');
    const integrationName = searchParams.get('integrationName');

    if (!eventName || !integrationName) {
      return NextResponse.json(
        { error: 'Missing eventName or integrationName' },
        { status: 400 }
      );
    }

    // Get data for the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const data = await db
      .select({
        timestamp: eventData.timestamp,
        count: eventData.count,
      })
      .from(eventData)
      .where(
        and(
          eq(eventData.eventName, eventName),
          eq(eventData.integrationName, integrationName),
          gte(eventData.timestamp, sevenDaysAgo)
        )
      )
      .orderBy(eventData.timestamp);

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching event data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
