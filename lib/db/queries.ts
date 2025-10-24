import { desc, and, eq, isNull, gte, inArray } from 'drizzle-orm';
import { db } from './drizzle';
import { activityLogs, teams, users, clients, eventData, alerts, organizationMembers, organizations, TeamDataWithMembers } from './schema';
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
    .from(organizations)
    .where(eq(organizations.stripeCustomerId, customerId))
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
  // Get user's first workspace via organization membership
  const result = await db
    .select({
      user: users,
      teamId: teams.id,
      organizationId: organizations.id
    })
    .from(users)
    .leftJoin(organizationMembers, eq(users.id, organizationMembers.userId))
    .leftJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
    .leftJoin(teams, eq(teams.organizationId, organizations.id))
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

export async function getCurrentTeamId() {
  const user = await getUser();
  if (!user) return null;

  const cookieStore = await cookies();
  const currentTeamCookie = cookieStore.get('current_team_id');
  
  if (currentTeamCookie) {
    const teamId = parseInt(currentTeamCookie.value);
    
    // Verify user has access to this team via organization membership
    const hasAccess = await db
      .select({ id: teams.id })
      .from(teams)
      .innerJoin(organizations, eq(teams.organizationId, organizations.id))
      .innerJoin(organizationMembers, eq(organizationMembers.organizationId, organizations.id))
      .where(
        and(
          eq(organizationMembers.userId, user.id),
          eq(teams.id, teamId)
        )
      )
      .limit(1);
    
    if (hasAccess.length > 0) {
      return teamId;
    }
  }

  // Get user's first team as default (via organization)
  const userTeam = await db
    .select({ teamId: teams.id })
    .from(organizationMembers)
    .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
    .innerJoin(teams, eq(teams.organizationId, organizations.id))
    .where(eq(organizationMembers.userId, user.id))
    .limit(1);

  return userTeam[0]?.teamId || null;
}

export async function getUserTeamRole(userId: number, teamId: number): Promise<string | null> {
  // Get organization role instead of team role
  const team = await db
    .select({ organizationId: teams.organizationId })
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1);

  if (!team[0]) return null;

  const membership = await db
    .select({ role: organizationMembers.role })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.organizationId, team[0].organizationId)
      )
    )
    .limit(1);

  return membership[0]?.role || null;
}

export async function isTeamOwner(userId: number, teamId: number): Promise<boolean> {
  const role = await getUserTeamRole(userId, teamId);
  return role === 'owner';
}

export async function getTeamForUser() {
  const user = await getUser();
  if (!user) {
    return null;
  }

  const currentTeamId = await getCurrentTeamId();
  if (!currentTeamId) {
    return null;
  }

  // Get the current team with organization
  const team = await db.query.teams.findFirst({
    where: eq(teams.id, currentTeamId),
    with: {
      organization: true
    }
  });

  if (!team) {
    return null;
  }

  // Get organization members instead of team members
  const { organizationMembers: orgMembersTable } = await import('./schema');
  const orgMembers = await db.query.organizationMembers.findMany({
    where: eq(orgMembersTable.organizationId, team.organizationId),
    with: {
      user: {
        columns: {
          id: true,
          name: true,
          email: true
        }
      }
    }
  });

  // Transform to match expected structure
  return {
    ...team,
    organizationMembers: orgMembers.map(member => ({
      id: member.id,
      userId: member.userId,
      organizationId: member.organizationId,
      role: member.role,
      joinedAt: member.joinedAt,
      user: member.user
    }))
  } as TeamDataWithMembers;
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

// Deprecated - use direct db.insert(clients).values() with all required fields
// export async function createClient(clientData: {
//   brandName: string;
//   brazeInstanceUrl?: string;
//   brazeApiKey?: string;
// }) {
//   const result = await db
//     .insert(clients)
//     .values(clientData)
//     .returning();

//   return result[0];
// }

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
  
  const query = db
    .selectDistinct({ 
      eventName: eventData.eventName,
      integrationName: eventData.integrationName 
    })
    .from(eventData)
    .where(conditions.length > 0 ? and(...conditions) : undefined);
  
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

  const baseQuery = db
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
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(alerts.createdAt));

  if (options?.limit) {
    return await baseQuery.limit(options.limit);
  }

  return await baseQuery;
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

// Deprecated - use direct db.insert(alerts).values() with all required fields including clientId
// export async function createAlert(alertData: {
//   brandName: string;
//   eventName: string;
//   ruleType: string;
//   severity: string;
//   message: string;
//   metadata?: any;
// }) {
//   const result = await db
//     .insert(alerts)
//     .values(alertData)
//     .returning();

//   return result[0];
// }

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
