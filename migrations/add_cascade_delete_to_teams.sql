-- Add CASCADE DELETE to team-related foreign keys

-- Drop existing foreign key constraints
ALTER TABLE team_members DROP CONSTRAINT IF EXISTS team_members_team_id_teams_id_fk;
ALTER TABLE activity_logs DROP CONSTRAINT IF EXISTS activity_logs_team_id_teams_id_fk;
ALTER TABLE invitations DROP CONSTRAINT IF EXISTS invitations_team_id_teams_id_fk;

-- Re-add foreign key constraints with CASCADE DELETE
ALTER TABLE team_members 
  ADD CONSTRAINT team_members_team_id_teams_id_fk 
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE;

ALTER TABLE activity_logs 
  ADD CONSTRAINT activity_logs_team_id_teams_id_fk 
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE;

ALTER TABLE invitations 
  ADD CONSTRAINT invitations_team_id_teams_id_fk 
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE;
