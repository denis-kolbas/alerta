'use server';

import { db } from '@/lib/db/drizzle';
import { clients } from '@/lib/db/schema';
import { getUser, getTeamForUser } from '@/lib/db/queries';
import { sql } from 'drizzle-orm';
import { eq, and } from 'drizzle-orm';
import { PubSub } from '@google-cloud/pubsub';

function sanitizeUrl(url: string): string {
  // Remove protocol (http://, https://)
  let sanitized = url.replace(/^https?:\/\//, '');
  
  // Remove www.
  sanitized = sanitized.replace(/^www\./, '');
  
  // Remove trailing slash
  sanitized = sanitized.replace(/\/$/, '');
  
  return sanitized;
}

async function triggerBackfill(clientId: string, brandName: string, instanceUrl: string, apiKey: string) {
  // Skip in local development if GCP credentials not configured
  if (process.env.NODE_ENV === 'development' && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.log('Skipping backfill trigger in local dev (no GCP credentials):', clientId, brandName);
    return;
  }

  try {
    // Fetch list of events from Braze
    const eventsResponse = await fetch(`https://${instanceUrl}/events/list`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    
    if (!eventsResponse.ok) {
      throw new Error(`Failed to fetch events: ${eventsResponse.status}`);
    }
    
    const eventsData = await eventsResponse.json();
    const events = eventsData.events || [];
    
    console.log(`Triggering backfill for ${events.length} events:`, clientId, brandName);

    // Publish one message per event
    const pubsub = new PubSub({
      projectId: process.env.GCP_PROJECT_ID || 'gen-lang-client-0044777751',
    });

    const topicName = 'braze-backfill-queue';
    const publishPromises = events.map((eventName: string) => {
      const message = {
        client_id: clientId,
        brand_name: brandName,
        instance_url: instanceUrl,
        api_key: apiKey,
        event_name: eventName, // NEW: specific event to backfill
      };

      const dataBuffer = Buffer.from(JSON.stringify(message));
      return pubsub.topic(topicName).publishMessage({ data: dataBuffer });
    });

    await Promise.all(publishPromises);
    console.log(`Published ${events.length} backfill jobs for:`, clientId, brandName);
  } catch (error) {
    console.error('Failed to trigger backfill:', error);
    throw error;
  }
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
      
      const wasInactive = !existingClient[0].isActive;
      
      await db
        .update(clients)
        .set(updateData)
        .where(eq(clients.id, existingClient[0].id));

      // Trigger backfill if reconnecting (was inactive, now active) and API key provided
      if (wasInactive && data.apiKey && data.apiKey.trim() !== '') {
        try {
          await triggerBackfill(existingClient[0].id, team.name, sanitizedUrl, data.apiKey);
          console.log('Triggered backfill for reconnected integration');
        } catch (error) {
          console.error('Failed to trigger backfill (non-fatal):', error);
        }
      }
    } else {
      // Insert new Braze integration
      const [newClient] = await db.insert(clients).values({
        teamId: team.id,
        integrationName: 'braze',
        brandName: team.name,
        brazeInstanceUrl: sanitizedUrl,
        brazeApiKey: sql`pgp_sym_encrypt(${data.apiKey}, ${encKey})`,
        blacklistedEvents: data.blacklistedEvents || [],
        isActive: true,
      }).returning();

      // Trigger backfill for new integration
      if (newClient) {
        try {
          await triggerBackfill(newClient.id, team.name, sanitizedUrl, data.apiKey);
        } catch (error) {
          console.error('Failed to trigger backfill (non-fatal):', error);
          // Don't fail the whole operation if backfill trigger fails
        }
      }
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
