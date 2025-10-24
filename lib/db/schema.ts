import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  integer,
  uuid,
  boolean,
  customType,
  jsonb,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

const bytea = customType<{ data: Buffer }>({
  dataType() {
    return 'bytea';
  },
});

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: varchar('role', { length: 20 }).notNull().default('member'),
  alertEmailPreference: varchar('alert_email_preference', { length: 20 }).notNull().default('critical_only'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'),
});

export const organizations = pgTable('organizations', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  stripeCustomerId: text('stripe_customer_id').unique(),
  stripeSubscriptionId: text('stripe_subscription_id').unique(),
  stripeProductId: text('stripe_product_id'),
  planName: varchar('plan_name', { length: 50 }),
  subscriptionStatus: varchar('subscription_status', { length: 20 }),
  subscriptionEndDate: timestamp('subscription_end_date'),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false),
  billingInterval: varchar('billing_interval', { length: 20 }),
  billingAmount: integer('billing_amount'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const organizationMembers = pgTable('organization_members', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  organizationId: integer('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 50 }).notNull(),
  joinedAt: timestamp('joined_at').notNull().defaultNow(),
});

export const teams = pgTable('teams', {
  id: serial('id').primaryKey(),
  organizationId: integer('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// team_members table removed - users access workspaces via organization membership

export const activityLogs = pgTable('activity_logs', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id, { onDelete: 'cascade' }),
  userId: integer('user_id').references(() => users.id),
  action: text('action').notNull(),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
  ipAddress: varchar('ip_address', { length: 45 }),
});

export const invitations = pgTable('invitations', {
  id: serial('id').primaryKey(),
  organizationId: integer('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  email: varchar('email', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).notNull(),
  invitedBy: integer('invited_by')
    .notNull()
    .references(() => users.id),
  invitedAt: timestamp('invited_at').notNull().defaultNow(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  token: varchar('token', { length: 255 }).notNull().unique(),
});

export const organizationsRelations = relations(organizations, ({ many }) => ({
  organizationMembers: many(organizationMembers),
  teams: many(teams),
  invitations: many(invitations),
}));

export const organizationMembersRelations = relations(organizationMembers, ({ one }) => ({
  user: one(users, {
    fields: [organizationMembers.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [organizationMembers.organizationId],
    references: [organizations.id],
  }),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [teams.organizationId],
    references: [organizations.id],
  }),
  activityLogs: many(activityLogs),
  clients: many(clients),
}));

export const usersRelations = relations(users, ({ many }) => ({
  organizationMembers: many(organizationMembers),
  invitationsSent: many(invitations),
}));

export const invitationsRelations = relations(invitations, ({ one }) => ({
  organization: one(organizations, {
    fields: [invitations.organizationId],
    references: [organizations.id],
  }),
  invitedBy: one(users, {
    fields: [invitations.invitedBy],
    references: [users.id],
  }),
}));

// teamMembersRelations removed - no longer needed

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  team: one(teams, {
    fields: [activityLogs.teamId],
    references: [teams.id],
  }),
  user: one(users, {
    fields: [activityLogs.userId],
    references: [users.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type OrganizationMember = typeof organizationMembers.$inferSelect;
export type NewOrganizationMember = typeof organizationMembers.$inferInsert;
export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
// TeamMember types removed - no longer needed
export type ActivityLog = typeof activityLogs.$inferSelect;
export type NewActivityLog = typeof activityLogs.$inferInsert;
export type Invitation = typeof invitations.$inferSelect;
export type NewInvitation = typeof invitations.$inferInsert;
export type AlertNotification = typeof alertNotifications.$inferSelect;
export type NewAlertNotification = typeof alertNotifications.$inferInsert;
export type TeamDataWithMembers = Team & {
  organization: Organization;
  organizationMembers: (OrganizationMember & {
    user: Pick<User, 'id' | 'name' | 'email'>;
  })[];
};

// Your custom tables
export const clients = pgTable('clients', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  teamId: integer('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  integrationName: varchar('integration_name', { length: 50 }).notNull(), // 'braze', 'mixpanel', 'klaviyo'
  brandName: text('brand_name').notNull(), // Team name for backward compatibility
  brazeInstanceUrl: text('braze_instance_url'),
  brazeApiKey: bytea('braze_api_key'), // Encrypted with pgp_sym_encrypt
  blacklistedEvents: jsonb('blacklisted_events').default([]), // Array of event names to exclude from monitoring
  isActive: boolean('is_active').default(true),
  backfillCompleted: boolean('backfill_completed').default(false),
  backfillStartedAt: timestamp('backfill_started_at'),
  backfillCompletedAt: timestamp('backfill_completed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  // Unique constraint: one team can only have one active integration per platform
  teamIntegrationUnique: sql`UNIQUE (team_id, integration_name) WHERE is_active = true`,
}));

export const eventData = pgTable('event_data', {
  id: serial('id').primaryKey(),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }),
  brand: varchar('brand').notNull(), // Keep for backward compatibility
  integrationName: varchar('integration_name', { length: 50 }), // 'braze', 'mixpanel', etc.
  eventName: varchar('event_name').notNull(),
  timestamp: timestamp('timestamp').notNull(),
  count: integer('count').notNull(),
}, (table) => ({
  uniqueEventData: sql`UNIQUE (client_id, event_name, timestamp)`,
}));

export const alerts = pgTable('alerts', {
  id: serial('id').primaryKey(),
  clientId: uuid('client_id').notNull().references(() => clients.id),
  brandName: text('brand_name').notNull(), // Denormalized for convenience
  eventName: text('event_name').notNull(),
  ruleType: varchar('rule_type', { length: 50 }).notNull(),
  severity: varchar('severity', { length: 20 }).notNull(),
  message: text('message').notNull(),
  metadata: jsonb('metadata'),
  status: varchar('status', { length: 20 }).notNull().default('active'), // 'active', 'resolved', 'dismissed'
  createdAt: timestamp('created_at').notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at'),
  isResolved: boolean('is_resolved').notNull().default(false),
});

export const alertNotifications = pgTable('alert_notifications', {
  id: serial('id').primaryKey(),
  alertId: integer('alert_id').notNull().references(() => alerts.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  sentAt: timestamp('sent_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Relations for your custom tables
export const clientsRelations = relations(clients, ({ one, many }) => ({
  team: one(teams, {
    fields: [clients.teamId],
    references: [teams.id],
  }),
  alerts: many(alerts),
}));

export const eventDataRelations = relations(eventData, ({ one }) => ({
  client: one(clients, {
    fields: [eventData.clientId],
    references: [clients.id],
  }),
}));

export const alertsRelations = relations(alerts, ({ one }) => ({
  client: one(clients, {
    fields: [alerts.clientId],
    references: [clients.id],
  }),
}));

// Types for your custom tables
export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
export type EventData = typeof eventData.$inferSelect;
export type NewEventData = typeof eventData.$inferInsert;
export type Alert = typeof alerts.$inferSelect;
export type NewAlert = typeof alerts.$inferInsert;

export enum ActivityType {
  SIGN_UP = 'SIGN_UP',
  SIGN_IN = 'SIGN_IN',
  SIGN_OUT = 'SIGN_OUT',
  UPDATE_PASSWORD = 'UPDATE_PASSWORD',
  DELETE_ACCOUNT = 'DELETE_ACCOUNT',
  UPDATE_ACCOUNT = 'UPDATE_ACCOUNT',
  CREATE_TEAM = 'CREATE_TEAM',
  REMOVE_TEAM_MEMBER = 'REMOVE_TEAM_MEMBER',
  INVITE_TEAM_MEMBER = 'INVITE_TEAM_MEMBER',
  ACCEPT_INVITATION = 'ACCEPT_INVITATION',
}
