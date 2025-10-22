-- ⚠️ WARNING: This will DELETE ALL DATA from all tables!
-- Use with caution - this cannot be undone!

-- Disable foreign key checks temporarily
SET session_replication_role = 'replica';

-- Delete all data from tables (order matters due to foreign keys)
TRUNCATE TABLE alert_notifications CASCADE;
TRUNCATE TABLE alerts CASCADE;
TRUNCATE TABLE event_data CASCADE;
TRUNCATE TABLE clients CASCADE;
TRUNCATE TABLE invitations CASCADE;
TRUNCATE TABLE activity_logs CASCADE;
TRUNCATE TABLE teams CASCADE;
TRUNCATE TABLE organization_members CASCADE;
TRUNCATE TABLE organizations CASCADE;
TRUNCATE TABLE users CASCADE;

-- Re-enable foreign key checks
SET session_replication_role = 'origin';

-- Reset sequences (auto-increment IDs)
ALTER SEQUENCE users_id_seq RESTART WITH 1;
ALTER SEQUENCE organizations_id_seq RESTART WITH 1;
ALTER SEQUENCE organization_members_id_seq RESTART WITH 1;
ALTER SEQUENCE teams_id_seq RESTART WITH 1;
ALTER SEQUENCE activity_logs_id_seq RESTART WITH 1;
ALTER SEQUENCE invitations_id_seq RESTART WITH 1;
ALTER SEQUENCE event_data_id_seq RESTART WITH 1;
ALTER SEQUENCE alerts_id_seq RESTART WITH 1;
ALTER SEQUENCE alert_notifications_id_seq RESTART WITH 1;

-- Verify all tables are empty
SELECT 'users' as table_name, COUNT(*) as row_count FROM users
UNION ALL
SELECT 'organizations', COUNT(*) FROM organizations
UNION ALL
SELECT 'organization_members', COUNT(*) FROM organization_members
UNION ALL
SELECT 'teams', COUNT(*) FROM teams
UNION ALL
SELECT 'clients', COUNT(*) FROM clients
UNION ALL
SELECT 'event_data', COUNT(*) FROM event_data
UNION ALL
SELECT 'alerts', COUNT(*) FROM alerts
UNION ALL
SELECT 'alert_notifications', COUNT(*) FROM alert_notifications
UNION ALL
SELECT 'activity_logs', COUNT(*) FROM activity_logs
UNION ALL
SELECT 'invitations', COUNT(*) FROM invitations;
