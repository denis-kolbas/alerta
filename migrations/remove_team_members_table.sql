-- Remove team_members table - no longer needed
-- Users access workspaces via organization membership

-- Drop the table (this will cascade delete all team member records)
DROP TABLE IF EXISTS team_members CASCADE;

-- Verify table is dropped
SELECT 'team_members table removed successfully' as status;
