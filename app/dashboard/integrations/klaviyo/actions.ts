'use server';

import { db } from '@/lib/db/drizzle';
import { clients } from '@/lib/db/schema';
import { getUser, getTeamForUser } from '@/lib/db/queries';
import { sql } from 'drizzle-orm';
import { eq, and } from 'drizzle-orm';

export async function saveKlaviyoIntegration(data: {
  apiKey: string;
}) {
  try {
    // Get authenticated user
    const user = await getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    // Get user's team
    const team = await getTeamForUser();
    if (!team) {
      return { success: false, error: 'No team found' };
    }

    // Get encryption key from environment
    const encKey = process.env.ENC_KEY;
    if (!encKey) {
      console.error('ENC_KEY environment variable not set');
      return { success: false, error: 'Server configuration error' };
    }

    // Check if Klaviyo integration already exists for this team
    const existingClient = await db
      .select()
      .from(clients)
      .where(
        and(
          eq(clients.teamId, team.id),
          eq(clients.integrationName, 'klaviyo')
        )
      )
      .limit(1);

    if (existingClient.length > 0) {
      // Update existing Klaviyo integration
      await db
        .update(clients)
        .set({
          brazeApiKey: sql`pgp_sym_encrypt(${data.apiKey}, ${encKey})`,
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(clients.id, existingClient[0].id));
    } else {
      // Insert new Klaviyo integration
      await db.insert(clients).values({
        teamId: team.id,
        integrationName: 'klaviyo',
        brandName: team.name,
        brazeApiKey: sql`pgp_sym_encrypt(${data.apiKey}, ${encKey})`,
        isActive: true,
      });
    }

    return { success: true };
  } catch (error) {
    console.error('Error saving Klaviyo integration:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to save integration' 
    };
  }
}
