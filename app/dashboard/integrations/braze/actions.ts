'use server';

import { db } from '@/lib/db/drizzle';
import { clients } from '@/lib/db/schema';
import { getUser, getTeamForUser } from '@/lib/db/queries';
import { sql } from 'drizzle-orm';
import { eq, and } from 'drizzle-orm';

function sanitizeUrl(url: string): string {
  // Remove protocol (http://, https://)
  let sanitized = url.replace(/^https?:\/\//, '');
  
  // Remove www.
  sanitized = sanitized.replace(/^www\./, '');
  
  // Remove trailing slash
  sanitized = sanitized.replace(/\/$/, '');
  
  return sanitized;
}

export async function saveBrazeIntegration(data: {
  brazeInstance: string;
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

    // Sanitize the Braze instance URL
    const sanitizedUrl = sanitizeUrl(data.brazeInstance);

    // Get encryption key from environment
    const encKey = process.env.ENC_KEY;
    if (!encKey) {
      console.error('ENC_KEY environment variable not set');
      return { success: false, error: 'Server configuration error' };
    }

    // Check if Braze integration already exists for this team
    const existingClient = await db
      .select()
      .from(clients)
      .where(
        and(
          eq(clients.teamId, team.id),
          eq(clients.integrationName, 'braze')
        )
      )
      .limit(1);

    if (existingClient.length > 0) {
      // Update existing Braze integration
      await db
        .update(clients)
        .set({
          brazeInstanceUrl: sanitizedUrl,
          brazeApiKey: sql`pgp_sym_encrypt(${data.apiKey}, ${encKey})`,
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(clients.id, existingClient[0].id));
    } else {
      // Insert new Braze integration
      await db.insert(clients).values({
        teamId: team.id,
        integrationName: 'braze',
        brandName: team.name,
        brazeInstanceUrl: sanitizedUrl,
        brazeApiKey: sql`pgp_sym_encrypt(${data.apiKey}, ${encKey})`,
        isActive: true,
      });
    }

    return { success: true };
  } catch (error) {
    console.error('Error saving Braze integration:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to save integration' 
    };
  }
}
