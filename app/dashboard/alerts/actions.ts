'use server';

import { db } from '@/lib/db/drizzle';
import { alerts } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getUser } from '@/lib/db/queries';

export async function updateAlertStatus(
  alertId: number,
  status: 'active' | 'resolved' | 'dismissed'
) {
  const user = await getUser();
  if (!user) {
    return { error: 'Unauthorized' };
  }

  try {
    // Update the alert status
    const updateData: any = { status };
    
    // Set resolved_at and is_resolved based on status
    if (status === 'resolved') {
      updateData.resolvedAt = new Date();
      updateData.isResolved = true;
    } else if (status === 'active') {
      updateData.resolvedAt = null;
      updateData.isResolved = false;
    } else if (status === 'dismissed') {
      updateData.resolvedAt = new Date();
      updateData.isResolved = true;
    }

    await db
      .update(alerts)
      .set(updateData)
      .where(eq(alerts.id, alertId));

    revalidatePath('/dashboard/analytics');
    
    return { success: true };
  } catch (error) {
    console.error('Failed to update alert status:', error);
    return { error: 'Failed to update alert status' };
  }
}
