'use server';

import { db } from '@/lib/db/drizzle';
import { clients } from '@/lib/db/schema';
import { getUser, getTeamForUser } from '@/lib/db/queries';
import { eq, and } from 'drizzle-orm';

export async function disconnectIntegration(integrationId: string) {
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

    // Update the client to set is_active to false
    await db
      .update(clients)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(clients.teamId, team.id),
          eq(clients.integrationName, integrationId)
        )
      );

    return { success: true };
  } catch (error) {
    console.error('Error disconnecting integration:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to disconnect integration' 
    };
  }
}
