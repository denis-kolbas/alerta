-- Create backup tables before wiping data
-- Run this BEFORE wipe_all_data.sql

CREATE TABLE IF NOT EXISTS users_backup AS SELECT * FROM users;
CREATE TABLE IF NOT EXISTS organizations_backup AS SELECT * FROM organizations;
CREATE TABLE IF NOT EXISTS organization_members_backup AS SELECT * FROM organization_members;
CREATE TABLE IF NOT EXISTS teams_backup AS SELECT * FROM teams;
CREATE TABLE IF NOT EXISTS team_members_backup AS SELECT * FROM team_members;
CREATE TABLE IF NOT EXISTS clients_backup AS SELECT * FROM clients;
CREATE TABLE IF NOT EXISTS event_data_backup AS SELECT * FROM event_data;
CREATE TABLE IF NOT EXISTS alerts_backup AS SELECT * FROM alerts;
CREATE TABLE IF NOT EXISTS alert_notifications_backup AS SELECT * FROM alert_notifications;
CREATE TABLE IF NOT EXISTS activity_logs_backup AS SELECT * FROM activity_logs;
CREATE TABLE IF NOT EXISTS invitations_backup AS SELECT * FROM invitations;

-- Verify backup
SELECT 'users_backup' as table_name, COUNT(*) as row_count FROM users_backup
UNION ALL
SELECT 'organizations_backup', COUNT(*) FROM organizations_backup
UNION ALL
SELECT 'teams_backup', COUNT(*) FROM teams_backup;
