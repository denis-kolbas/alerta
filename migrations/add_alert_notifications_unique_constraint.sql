-- Add unique constraint to alert_notifications table
-- This is required for the ON CONFLICT clause in the alert-notifier

-- First, remove any duplicate entries (keep the most recent one)
DELETE FROM alert_notifications a
USING alert_notifications b
WHERE a.id < b.id 
  AND a.alert_id = b.alert_id 
  AND a.user_id = b.user_id;

-- Now add the unique constraint
ALTER TABLE alert_notifications 
ADD CONSTRAINT alert_notifications_alert_id_user_id_key 
UNIQUE (alert_id, user_id);
