# Database Schema Documentation

**Last Updated:** 2025-10-19

This document contains the complete, up-to-date database schema for the Alerta application.

## Tables

### users
```sql
CREATE TABLE public.users (
  id integer NOT NULL DEFAULT nextval('users_id_seq'::regclass),
  name character varying,
  email character varying NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role character varying NOT NULL DEFAULT 'member'::character varying,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  deleted_at timestamp without time zone,
  alert_email_preference character varying NOT NULL DEFAULT 'critical_only'::character varying,
  CONSTRAINT users_pkey PRIMARY KEY (id)
);
```

### teams
```sql
CREATE TABLE public.teams (
  id integer NOT NULL DEFAULT nextval('teams_id_seq'::regclass),
  name character varying NOT NULL,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  stripe_customer_id text UNIQUE,
  stripe_subscription_id text UNIQUE,
  stripe_product_id text,
  plan_name character varying,
  subscription_status character varying,
  CONSTRAINT teams_pkey PRIMARY KEY (id)
);
```

### team_members
```sql
CREATE TABLE public.team_members (
  id integer NOT NULL DEFAULT nextval('team_members_id_seq'::regclass),
  user_id integer NOT NULL,
  team_id integer NOT NULL,
  role character varying NOT NULL,
  joined_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT team_members_pkey PRIMARY KEY (id),
  CONSTRAINT team_members_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT team_members_team_id_teams_id_fk FOREIGN KEY (team_id) REFERENCES public.teams(id)
);
```

### clients
**Purpose:** Stores integration configurations for each team (Braze, Klaviyo, etc.)

```sql
CREATE TABLE public.clients (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  team_id integer NOT NULL,
  integration_name character varying NOT NULL,
  brand_name text NOT NULL,
  braze_instance_url text,
  braze_api_key bytea,  -- Encrypted with pgcrypto
  blacklisted_events jsonb DEFAULT '[]'::jsonb,  -- Array of event names to exclude from monitoring
  is_active boolean DEFAULT true,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT clients_pkey PRIMARY KEY (id),
  CONSTRAINT clients_team_id_teams_id_fk FOREIGN KEY (team_id) REFERENCES public.teams(id)
);
```

**Key Points:**
- `id` (UUID) is the primary key and source of truth
- `integration_name` can be: 'braze', 'klaviyo', etc.
- `brand_name` is for human-readable identification
- `braze_api_key` is encrypted using pgcrypto
- `blacklisted_events` stores event names that should be excluded from monitoring
- A team can have multiple clients (e.g., multiple Braze instances)

### event_data
**Purpose:** Stores hourly event counts from integrations

```sql
CREATE TABLE public.event_data (
  id integer NOT NULL DEFAULT nextval('event_data_id_seq'::regclass),
  client_id uuid,
  brand character varying NOT NULL,
  integration_name character varying,
  event_name character varying NOT NULL,
  timestamp timestamp without time zone NOT NULL,
  count integer NOT NULL,
  CONSTRAINT event_data_pkey PRIMARY KEY (id),
  CONSTRAINT event_data_client_id_clients_id_fk FOREIGN KEY (client_id) REFERENCES public.clients(id),
  CONSTRAINT event_data_client_id_event_name_timestamp_key UNIQUE (client_id, event_name, timestamp)
);

-- Indexes for performance
CREATE INDEX idx_event_data_client_id_timestamp ON event_data (client_id, timestamp DESC);
CREATE INDEX idx_event_data_client_id_event_name ON event_data (client_id, event_name);
```

**Key Points:**
- `client_id` is the source of truth (references `clients.id`)
- `brand` and `integration_name` are kept for backward compatibility and human readability
- **UNIQUE constraint** on `(client_id, event_name, timestamp)` prevents duplicates
- Workers use `ON CONFLICT (client_id, event_name, timestamp) DO NOTHING` when inserting

### alerts
**Purpose:** Stores anomaly detection alerts

```sql
CREATE TABLE public.alerts (
  id integer NOT NULL DEFAULT nextval('alerts_id_seq'::regclass),
  client_id uuid NOT NULL,
  brand_name text NOT NULL,
  event_name text NOT NULL,
  rule_type character varying NOT NULL,  -- 'silence_detection', 'spike_detection', 'drop_detection'
  severity character varying NOT NULL,    -- 'warning', 'critical'
  message text NOT NULL,
  metadata jsonb,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  resolved_at timestamp without time zone,
  is_resolved boolean NOT NULL DEFAULT false,
  status character varying NOT NULL DEFAULT 'active'::character varying,
  CONSTRAINT alerts_pkey PRIMARY KEY (id),
  CONSTRAINT alerts_client_id_clients_id_fk FOREIGN KEY (client_id) REFERENCES public.clients(id)
);
```

**Key Points:**
- `client_id` links to the specific integration
- `rule_type` indicates which detection rule triggered the alert
- `metadata` contains additional context (baseline values, thresholds, etc.)
- `status` can be: 'active', 'resolved', 'acknowledged'

### alert_notifications
**Purpose:** Tracks alert notifications sent to users

```sql
CREATE TABLE public.alert_notifications (
  id integer NOT NULL DEFAULT nextval('alert_notifications_id_seq'::regclass),
  alert_id integer NOT NULL,
  user_id integer NOT NULL,
  status character varying NOT NULL DEFAULT 'pending'::character varying,
  sent_at timestamp without time zone,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT alert_notifications_pkey PRIMARY KEY (id),
  CONSTRAINT alert_notifications_alert_id_alerts_id_fk FOREIGN KEY (alert_id) REFERENCES public.alerts(id),
  CONSTRAINT alert_notifications_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id)
);
```

### invitations
**Purpose:** Manages team invitation tokens

```sql
CREATE TABLE public.invitations (
  id integer NOT NULL DEFAULT nextval('invitations_id_seq'::regclass),
  team_id integer NOT NULL,
  email character varying NOT NULL,
  role character varying NOT NULL,
  invited_by integer NOT NULL,
  invited_at timestamp without time zone NOT NULL DEFAULT now(),
  status character varying NOT NULL DEFAULT 'pending'::character varying,
  token character varying NOT NULL UNIQUE,
  CONSTRAINT invitations_pkey PRIMARY KEY (id),
  CONSTRAINT invitations_team_id_teams_id_fk FOREIGN KEY (team_id) REFERENCES public.teams(id),
  CONSTRAINT invitations_invited_by_users_id_fk FOREIGN KEY (invited_by) REFERENCES public.users(id)
);
```

### activity_logs
**Purpose:** Audit log for team activities

```sql
CREATE TABLE public.activity_logs (
  id integer NOT NULL DEFAULT nextval('activity_logs_id_seq'::regclass),
  team_id integer NOT NULL,
  user_id integer,
  action text NOT NULL,
  timestamp timestamp without time zone NOT NULL DEFAULT now(),
  ip_address character varying,
  CONSTRAINT activity_logs_pkey PRIMARY KEY (id),
  CONSTRAINT activity_logs_team_id_teams_id_fk FOREIGN KEY (team_id) REFERENCES public.teams(id),
  CONSTRAINT activity_logs_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id)
);
```

## Key Relationships

```
teams (1) ──→ (N) team_members ──→ (1) users
teams (1) ──→ (N) clients
clients (1) ──→ (N) event_data
clients (1) ──→ (N) alerts
alerts (1) ──→ (N) alert_notifications ──→ (1) users
teams (1) ──→ (N) invitations
teams (1) ──→ (N) activity_logs
```

## Important Notes

1. **client_id is the source of truth**: All workers and analyzers use `clients.id` (UUID) as the primary identifier
2. **Unique constraint on event_data**: Prevents duplicate hourly data from being inserted
3. **Encrypted API keys**: `braze_api_key` is encrypted using pgcrypto's `pgp_sym_encrypt()`
4. **Soft deletes**: Users have a `deleted_at` column for soft deletion
5. **Timestamps**: Most tables use `timestamp without time zone` with `DEFAULT now()`

## Migration History

- `fix_clients_schema.sql` - Added `client_id` to event_data and alerts
- `add_alert_status.sql` - Added status tracking to alerts
- `remove_duplicates_and_add_constraint.sql` - Removed duplicates and added unique constraint on event_data
- `add_blacklisted_events_column.sql` - Added blacklisted_events column to clients table for event filtering
