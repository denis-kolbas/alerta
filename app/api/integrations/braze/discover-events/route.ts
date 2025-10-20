import { NextRequest, NextResponse } from 'next/server';
import { getTeamForUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { clients } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const { instanceUrl, apiKey, useExistingCredentials } = await request.json();

    let actualApiKey = apiKey;
    let actualInstanceUrl = instanceUrl;

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

      // Fetch existing Braze integration
      const existingClient = await db
        .select({
          brazeInstanceUrl: clients.brazeInstanceUrl,
          brazeApiKey: sql<string>`pgp_sym_decrypt(${clients.brazeApiKey}, ${encKey})`,
        })
        .from(clients)
        .where(
          and(
            eq(clients.teamId, team.id),
            eq(clients.integrationName, 'braze'),
            eq(clients.isActive, true)
          )
        )
        .limit(1);

      if (existingClient.length === 0) {
        return NextResponse.json(
          { error: 'No existing Braze integration found' },
          { status: 404 }
        );
      }

      actualApiKey = existingClient[0].brazeApiKey;
      actualInstanceUrl = existingClient[0].brazeInstanceUrl || instanceUrl;
    }

    if (!actualInstanceUrl || !actualApiKey) {
      return NextResponse.json(
        { error: 'Instance URL and API key are required' },
        { status: 400 }
      );
    }

    // Clean up instance URL (remove https:// if user included it)
    const cleanInstanceUrl = actualInstanceUrl.replace(/^https?:\/\//, '');

    // Call Braze API to fetch events list
    const brazeUrl = `https://${cleanInstanceUrl}/events/list`;
    
    const response = await fetch(brazeUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${actualApiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        return NextResponse.json(
          { error: 'Invalid API key. Please check your credentials.' },
          { status: 401 }
        );
      }
      if (response.status === 404) {
        return NextResponse.json(
          { error: 'Invalid instance URL. Please check your Braze instance.' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to connect to Braze. Please verify your credentials.' },
        { status: response.status }
      );
    }

    const data = await response.json();
    const events = data.events || [];

    return NextResponse.json({ 
      success: true,
      events: events.sort() // Sort alphabetically
    });

  } catch (error) {
    console.error('Error discovering Braze events:', error);
    
    const errorMessage = error instanceof Error ? error.message : '';
    if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('getaddrinfo')) {
      return NextResponse.json(
        { error: 'Invalid instance URL. Please check your Braze instance.' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
