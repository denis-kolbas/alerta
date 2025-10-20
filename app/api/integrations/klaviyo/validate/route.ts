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

    // Validate API key by making a simple request to Klaviyo API
    // Using the /api/accounts endpoint to verify credentials
    const response = await fetch('https://a.klaviyo.com/api/accounts/', {
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
        { error: 'Failed to validate Klaviyo API key.' },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({ 
      success: true,
      accountName: data.data?.attributes?.test_account ? 'Test Account' : 'Production Account'
    });

  } catch (error) {
    console.error('Error validating Klaviyo API key:', error);
    
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
