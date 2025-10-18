import { desc, and, eq, isNull, gte, inArray } from 'drizzle-orm';
import { db } from './drizzle';
import { activityLogs, teamMembers, teams, users, clients, eventData, alerts } from './schema';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/session';

export async function getUser() {
  const sessionCookie = (await cookies()).get('session');
  if (!sessionCookie || !sessionCookie.value) {
    return null;
  }

  const sessionData = await verifyToken(sessionCookie.value);
  if (
    !sessionData ||
    !sessionData.user ||
    typeof sessionData.user.id !== 'number'
  ) {
    return null;
  }

  if (new Date(sessionData.expires) < new Date()) {
    return null;
  }

  const user = await db
    .select()
    .from(users)
    .where(and(eq(users.id, sessionData.user.id), isNull(users.deletedAt)))
    .limit(1);

  if (user.length === 0) {
    return null;
  }

  return user[0];
}

export async function getTeamByStripeCustomerId(customerId: string) {
  const result = await db
    .select()
    .from(teams)
    .where(eq(teams.stripeCustomerId, customerId))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

export async function updateTeamSubscription(
  teamId: number,
  subscriptionData: {
    stripeSubscriptionId: string | null;
    stripeProductId: string | null;
    planName: string | null;
    subscriptionStatus: string;
  }
) {
  await db
    .update(teams)
    .set({
      ...subscriptionData,
      updatedAt: new Date()
    })
    .where(eq(teams.id, teamId));
}

export async function getUserWithTeam(userId: number) {
  const result = await db
    .select({
      user: users,
      teamId: teamMembers.teamId
    })
    .from(users)
    .leftJoin(teamMembers, eq(users.id, teamMembers.userId))
    .where(eq(users.id, userId))
    .limit(1);

  return result[0];
}

export async function getActivityLogs() {
  const user = await getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  return await db
    .select({
      id: activityLogs.id,
      action: activityLogs.action,
      timestamp: activityLogs.timestamp,
      ipAddress: activityLogs.ipAddress,
      userName: users.name
    })
    .from(activityLogs)
    .leftJoin(users, eq(activityLogs.userId, users.id))
    .where(eq(activityLogs.userId, user.id))
    .orderBy(desc(activityLogs.timestamp))
    .limit(10);
}

export async function getTeamForUser() {
  const user = await getUser();
  if (!user) {
    return null;
  }

  const result = await db.query.teamMembers.findFirst({
    where: eq(teamMembers.userId, user.id),
    with: {
      team: {
        with: {
          teamMembers: {
            with: {
              user: {
                columns: {
                  id: true,
                  name: true,
                  email: true
                }
              }
            }
          }
        }
      }
    }
  });

  return result?.team || null;
}
// Queries for your custom tables

export async function getAllClients() {
  return await db
    .select()
    .from(clients)
    .where(eq(clients.isActive, true))
    .orderBy(clients.brandName);
}

export async function getClientById(id: string) {
  const result = await db
    .select()
    .from(clients)
    .where(eq(clients.id, id))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

export async function getClientByBrandName(brandName: string) {
  const result = await db
    .select()
    .from(clients)
    .where(eq(clients.brandName, brandName))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

export async function getEventDataByBrand(brand: string, limit: number = 100) {
  return await db
    .select()
    .from(eventData)
    .where(eq(eventData.brand, brand))
    .orderBy(desc(eventData.timestamp))
    .limit(limit);
}

export async function getEventDataByClient(clientId: string, limit: number = 100) {
  return await db
    .select()
    .from(eventData)
    .where(eq(eventData.clientId, clientId))
    .orderBy(desc(eventData.timestamp))
    .limit(limit);
}

export async function getRecentEventData(limit: number = 50) {
  return await db
    .select()
    .from(eventData)
    .orderBy(desc(eventData.timestamp))
    .limit(limit);
}

export async function createClient(clientData: {
  brandName: string;
  brazeInstanceUrl?: string;
  brazeApiKey?: string;
}) {
  const result = await db
    .insert(clients)
    .values(clientData)
    .returning();

  return result[0];
}

export async function createEventData(eventDataItem: {
  brand: string;
  eventName: string;
  timestamp: Date;
  count: number;
}) {
  const result = await db
    .insert(eventData)
    .values(eventDataItem)
    .returning();

  return result[0];
}

// Analytics queries for time series data
export async function getEventTimeSeries(
  eventNames?: string[], 
  brand?: string, 
  hours: number = 24 * 7, // Default to last 7 days
  teamId?: number,
  integrationNames?: string[]
) {
  const hoursAgo = new Date();
  hoursAgo.setHours(hoursAgo.getHours() - hours);

  const conditions = [gte(eventData.timestamp, hoursAgo)];
  
  if (eventNames && eventNames.length > 0) {
    conditions.push(inArray(eventData.eventName, eventNames));
  }
  
  if (brand) {
    conditions.push(eq(eventData.brand, brand));
  }

  // Filter by team_id through clients relationship (only active integrations)
  if (teamId) {
    const clientConditions = [
      eq(clients.teamId, teamId),
      eq(clients.isActive, true)
    ];
    
    // Filter by specific integrations if provided
    if (integrationNames && integrationNames.length > 0) {
      clientConditions.push(inArray(clients.integrationName, integrationNames));
    }
    
    const teamClientIds = await db
      .select({ id: clients.id })
      .from(clients)
      .where(and(...clientConditions));
    
    const clientIds = teamClientIds.map(c => c.id);
    if (clientIds.length > 0) {
      conditions.push(inArray(eventData.clientId, clientIds));
    } else {
      // No active clients for this team, return empty
      return [];
    }
  }

  return await db
    .select()
    .from(eventData)
    .where(and(...conditions))
    .orderBy(eventData.timestamp);
}

export async function getUniqueEventNames(brand?: string, teamId?: number, integrationNames?: string[]) {
  const conditions = [];
  
  if (brand) {
    conditions.push(eq(eventData.brand, brand));
  }

  // Filter by team_id through clients relationship (only active integrations)
  if (teamId) {
    const clientConditions = [
      eq(clients.teamId, teamId),
      eq(clients.isActive, true)
    ];
    
    // Filter by specific integrations if provided
    if (integrationNames && integrationNames.length > 0) {
      clientConditions.push(inArray(clients.integrationName, integrationNames));
    }
    
    const teamClientIds = await db
      .select({ id: clients.id, integrationName: clients.integrationName })
      .from(clients)
      .where(and(...clientConditions));
    
    const clientIds = teamClientIds.map(c => c.id);
    if (clientIds.length > 0) {
      conditions.push(inArray(eventData.clientId, clientIds));
    } else {
      // No clients for this team, return empty
      return [];
    }
  }
  
  let query = db
    .selectDistinct({ 
      eventName: eventData.eventName,
      integrationName: eventData.integrationName 
    })
    .from(eventData);
    
  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }
  
  const result = await query;
  // Prefix event names with integration name
  return result.map(row => {
    const integration = row.integrationName || 'unknown';
    return `${integration}: ${row.eventName}`;
  });
}

export async function getActiveIntegrations(teamId: number) {
  const result = await db
    .selectDistinct({ integrationName: clients.integrationName })
    .from(clients)
    .where(
      and(
        eq(clients.teamId, teamId),
        eq(clients.isActive, true)
      )
    );
  
  return result.map(row => row.integrationName);
}

export async function getUniqueBrands() {
  try {
    const result = await db
      .selectDistinct({ brand: eventData.brand })
      .from(eventData);
      
    return result.map(row => row.brand);
  } catch (error) {
    console.error('Error fetching unique brands:', error);
    return [];
  }
}

// Alert queries
export async function getAlerts(options?: {
  brandName?: string;
  teamId?: number;
  isResolved?: boolean;
  limit?: number;
}) {
  const conditions = [];
  
  if (options?.brandName) {
    conditions.push(eq(alerts.brandName, options.brandName));
  }

  // Filter by team_id through clients relationship (only active integrations)
  if (options?.teamId) {
    const teamClientIds = await db
      .select({ id: clients.id })
      .from(clients)
      .where(
        and(
          eq(clients.teamId, options.teamId),
          eq(clients.isActive, true)
        )
      );
    
    const clientIds = teamClientIds.map(c => c.id);
    if (clientIds.length > 0) {
      conditions.push(inArray(alerts.clientId, clientIds));
    } else {
      // No active clients for this team, return empty
      return [];
    }
  }
  
  if (options?.isResolved !== undefined) {
    conditions.push(eq(alerts.isResolved, options.isResolved));
  }

  let query = db
    .select({
      id: alerts.id,
      clientId: alerts.clientId,
      brandName: alerts.brandName,
      eventName: alerts.eventName,
      ruleType: alerts.ruleType,
      severity: alerts.severity,
      message: alerts.message,
      metadata: alerts.metadata,
      status: alerts.status,
      createdAt: alerts.createdAt,
      resolvedAt: alerts.resolvedAt,
      isResolved: alerts.isResolved,
      integrationName: clients.integrationName,
    })
    .from(alerts)
    .leftJoin(clients, eq(alerts.clientId, clients.id))
    .orderBy(desc(alerts.createdAt));

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  return await query;
}

export async function getAlertById(id: number) {
  const result = await db
    .select()
    .from(alerts)
    .where(eq(alerts.id, id))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

export async function getUnresolvedAlertCount(brandName?: string) {
  const conditions = [eq(alerts.isResolved, false)];
  
  if (brandName) {
    conditions.push(eq(alerts.brandName, brandName));
  }

  const result = await db
    .select()
    .from(alerts)
    .where(and(...conditions));

  return result.length;
}

export async function checkExistingAlert(
  brandName: string,
  eventName: string,
  ruleType: string
) {
  const oneDayAgo = new Date();
  oneDayAgo.setHours(oneDayAgo.getHours() - 24);

  const result = await db
    .select()
    .from(alerts)
    .where(
      and(
        eq(alerts.brandName, brandName),
        eq(alerts.eventName, eventName),
        eq(alerts.ruleType, ruleType),
        eq(alerts.isResolved, false),
        gte(alerts.createdAt, oneDayAgo)
      )
    )
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

export async function createAlert(alertData: {
  brandName: string;
  eventName: string;
  ruleType: string;
  severity: string;
  message: string;
  metadata?: any;
}) {
  const result = await db
    .insert(alerts)
    .values(alertData)
    .returning();

  return result[0];
}

export async function resolveAlert(id: number) {
  const result = await db
    .update(alerts)
    .set({
      isResolved: true,
      resolvedAt: new Date(),
    })
    .where(eq(alerts.id, id))
    .returning();

  return result.length > 0 ? result[0] : null;
}

export async function getEventDataForAnalysis(
  brandName: string,
  eventName: string,
  hours: number = 168 // 7 days
) {
  const hoursAgo = new Date();
  hoursAgo.setHours(hoursAgo.getHours() - hours);

  return await db
    .select()
    .from(eventData)
    .where(
      and(
        eq(eventData.brand, brandName),
        eq(eventData.eventName, eventName),
        gte(eventData.timestamp, hoursAgo)
      )
    )
    .orderBy(eventData.timestamp);
}
