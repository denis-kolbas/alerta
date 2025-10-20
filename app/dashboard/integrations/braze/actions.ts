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
  blacklistedEvents?: string[];
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
      const updateData: Record<string, unknown> = {
        brazeInstanceUrl: sanitizedUrl,
        blacklistedEvents: data.blacklistedEvents || [],
        isActive: true,
        updatedAt: new Date(),
      };
      
      // Only update API key if a new one was provided
      if (data.apiKey && data.apiKey.trim() !== '') {
        updateData.brazeApiKey = sql`pgp_sym_encrypt(${data.apiKey}, ${encKey})`;
      }
      
      await db
        .update(clients)
        .set(updateData)
        .where(eq(clients.id, existingClient[0].id));
    } else {
      // Insert new Braze integration
      await db.insert(clients).values({
        teamId: team.id,
        integrationName: 'braze',
        brandName: team.name,
        brazeInstanceUrl: sanitizedUrl,
        brazeApiKey: sql`pgp_sym_encrypt(${data.apiKey}, ${encKey})`,
        blacklistedEvents: data.blacklistedEvents || [],
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

export async function disconnectBrazeIntegration() {
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

    // Deactivate the Braze integration
    await db
      .update(clients)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(clients.teamId, team.id),
          eq(clients.integrationName, 'braze')
        )
      );

    return { success: true };
  } catch (error) {
    console.error('Error disconnecting Braze integration:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to disconnect integration' 
    };
  }
}
