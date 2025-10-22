-- Add organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_product_id TEXT,
  plan_name VARCHAR(50),
  subscription_status VARCHAR(20),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Add organization_members table
CREATE TABLE IF NOT EXISTS organization_members (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL,
  joined_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, organization_id)
);

-- Add organization_id to teams FIRST
ALTER TABLE teams ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE;

-- Migrate existing teams to organizations
-- For each team, create an organization and migrate data
DO $$
DECLARE
  team_record RECORD;
  new_org_id INTEGER;
BEGIN
  FOR team_record IN SELECT * FROM teams LOOP
    -- Create organization from team
    INSERT INTO organizations (
      name,
      stripe_customer_id,
      stripe_subscription_id,
      stripe_product_id,
      plan_name,
      subscription_status,
      created_at,
      updated_at
    ) VALUES (
      team_record.name,
      team_record.stripe_customer_id,
      team_record.stripe_subscription_id,
      team_record.stripe_product_id,
      team_record.plan_name,
      team_record.subscription_status,
      team_record.created_at,
      team_record.updated_at
    ) RETURNING id INTO new_org_id;
    
    -- Migrate team members to organization members
    INSERT INTO organization_members (user_id, organization_id, role, joined_at)
    SELECT user_id, new_org_id, role, joined_at
    FROM team_members
    WHERE team_id = team_record.id;
    
    -- Update team to reference organization
    UPDATE teams SET organization_id = new_org_id WHERE id = team_record.id;
    
    -- Update team_members: change 'owner' to 'admin'
    UPDATE team_members SET role = 'admin' WHERE team_id = team_record.id AND role = 'owner';
  END LOOP;
END $$;

-- Make organization_id required after migration
ALTER TABLE teams ALTER COLUMN organization_id SET NOT NULL;

-- Remove subscription fields from teams (now on organizations)
ALTER TABLE teams DROP COLUMN IF EXISTS stripe_customer_id;
ALTER TABLE teams DROP COLUMN IF EXISTS stripe_subscription_id;
ALTER TABLE teams DROP COLUMN IF EXISTS stripe_product_id;
ALTER TABLE teams DROP COLUMN IF EXISTS plan_name;
ALTER TABLE teams DROP COLUMN IF EXISTS subscription_status;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_organization_members_user_id ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_org_id ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_teams_organization_id ON teams(organization_id);
