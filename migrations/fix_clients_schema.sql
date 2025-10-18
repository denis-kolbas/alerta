-- Fix clients table schema to properly link to teams
-- This is a fresh start for clients and alerts (keeps event_data)

-- Step 1: Drop dependent tables/constraints first
DROP TABLE IF EXISTS alerts CASCADE;
DROP TABLE IF EXISTS clients CASCADE;

-- Step 2: Recreate clients table with proper schema
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  integration_name VARCHAR(50) NOT NULL,
  brand_name TEXT NOT NULL,
  braze_instance_url TEXT,
  braze_api_key BYTEA,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Step 3: Add unique constraint (one active integration per platform per team)
CREATE UNIQUE INDEX clients_team_integration_unique 
  ON clients(team_id, integration_name) 
  WHERE is_active = true;

-- Step 4: Add indexes for performance
CREATE INDEX idx_clients_team_id ON clients(team_id);
CREATE INDEX idx_clients_brand_name ON clients(brand_name);

-- Step 5: Recreate alerts table with proper foreign keys
CREATE TABLE alerts (
  id SERIAL PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  brand_name TEXT NOT NULL,
  event_name TEXT NOT NULL,
  rule_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMP,
  is_resolved BOOLEAN NOT NULL DEFAULT false
);

-- Step 6: Add indexes for alerts
CREATE INDEX idx_alerts_client_id ON alerts(client_id);
CREATE INDEX idx_alerts_brand_event ON alerts(brand_name, event_name);
CREATE INDEX idx_alerts_unresolved ON alerts(is_resolved, created_at DESC);
CREATE INDEX idx_alerts_rule_type ON alerts(rule_type);

-- Note: event_data table is NOT touched - all historical data preserved
