import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { eventData } from '@/lib/db/schema';
import { and, eq, gte, lte } from 'drizzle-orm';
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
    const endTime = searchParams.get('endTime');
    const hours = searchParams.get('hours');

    if (!eventName || !integrationName) {
      return NextResponse.json(
        { error: 'Missing eventName or integrationName' },
        { status: 400 }
      );
    }

    // Determine time range
    let startDate: Date;
    let endDate: Date;

    if (endTime && hours) {
      // Get X hours before the specified end time (for alert context)
      endDate = new Date(endTime);
      const hoursToSubtract = parseInt(hours);
      startDate = new Date(endDate.getTime() - hoursToSubtract * 60 * 60 * 1000);
    } else {
      // Default: last 7 days
      endDate = new Date();
      startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    }

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
          gte(eventData.timestamp, startDate),
          lte(eventData.timestamp, endDate)
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
