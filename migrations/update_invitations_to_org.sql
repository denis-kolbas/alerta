-- Update invitations table to reference organizations instead of teams

-- Add organization_id column
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS organization_id INTEGER;

-- Populate organization_id from team_id
UPDATE invitations 
SET organization_id = teams.organization_id 
FROM teams 
WHERE invitations.team_id = teams.id;

-- Make organization_id required
ALTER TABLE invitations ALTER COLUMN organization_id SET NOT NULL;

-- Add foreign key constraint
ALTER TABLE invitations 
ADD CONSTRAINT invitations_organization_id_organizations_id_fk 
FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

-- Drop old team_id column
ALTER TABLE invitations DROP COLUMN IF EXISTS team_id;

-- Update index
CREATE INDEX IF NOT EXISTS idx_invitations_organization_id ON invitations(organization_id);
