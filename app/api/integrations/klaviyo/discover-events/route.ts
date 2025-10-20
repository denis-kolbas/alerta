import { NextRequest, NextResponse } from 'next/server';
import { getTeamForUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { clients } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const { apiKey, useExistingCredentials } = await request.json();

    let actualApiKey = apiKey;

    // If using existing credentials, fetch from database
    if (useExistingCredentials) {
      const team = await getTeamForUser();
      if (!team) {
        return NextResponse.json(
          { error: 'Not authenticated' },
          { status: 401 }
        );
      }

      const encKey = process.env.ENC_KEY;
      if (!encKey) {
        return NextResponse.json(
          { error: 'Server configuration error' },
          { status: 500 }
        );
      }

      // Fetch existing Klaviyo integration
      const existingClient = await db
        .select({
          brazeApiKey: sql<string>`pgp_sym_decrypt(${clients.brazeApiKey}, ${encKey})`,
        })
        .from(clients)
        .where(
          and(
            eq(clients.teamId, team.id),
            eq(clients.integrationName, 'klaviyo'),
            eq(clients.isActive, true)
          )
        )
        .limit(1);

      if (existingClient.length === 0) {
        return NextResponse.json(
          { error: 'No existing Klaviyo integration found' },
          { status: 404 }
        );
      }

      actualApiKey = existingClient[0].brazeApiKey;
    }

    if (!actualApiKey) {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 400 }
      );
    }

    // Fetch metrics (event types) from Klaviyo
    const response = await fetch('https://a.klaviyo.com/api/metrics/', {
      method: 'GET',
      headers: {
        'Authorization': `Klaviyo-API-Key ${actualApiKey}`,
        'revision': '2024-10-15',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return NextResponse.json(
          { error: 'Invalid API key. Please check your credentials.' },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to fetch events from Klaviyo.' },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Extract metric names (these are the event types)
    const events = data.data?.map((metric: any) => metric.attributes?.name).filter(Boolean) || [];

    return NextResponse.json({ 
      success: true,
      events: events.sort() // Sort alphabetically
    });

  } catch (error) {
    console.error('Error discovering Klaviyo events:', error);
    
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
