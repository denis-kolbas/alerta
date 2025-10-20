-- Add email notification preference to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS alert_email_preference VARCHAR(20) DEFAULT 'all';
-- Options: 'all', 'critical_only', 'none'

-- Create alert_notifications table to track which alerts have been sent to which users
CREATE TABLE IF NOT EXISTS alert_notifications (
  id SERIAL PRIMARY KEY,
  alert_id INTEGER NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'failed'
  sent_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(alert_id, user_id)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_alert_notifications_status ON alert_notifications(status);
CREATE INDEX IF NOT EXISTS idx_alert_notifications_user_sent ON alert_notifications(user_id, sent_at);
