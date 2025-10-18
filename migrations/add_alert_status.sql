-- Add status column to alerts table (if it doesn't exist)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'alerts' AND column_name = 'status'
  ) THEN
    ALTER TABLE alerts 
    ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active';
  END IF;
END $$;

-- Migrate existing data: set status based on is_resolved
UPDATE alerts 
SET status = CASE 
  WHEN is_resolved = true THEN 'resolved'
  ELSE 'active'
END
WHERE status = 'active' AND is_resolved = true;

-- Add check constraint for valid status values (if it doesn't exist)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE constraint_name = 'alerts_status_check'
  ) THEN
    ALTER TABLE alerts 
    ADD CONSTRAINT alerts_status_check 
    CHECK (status IN ('active', 'resolved', 'dismissed'));
  END IF;
END $$;

-- Fix is_resolved default (it should default to false, not true)
-- First, fix any incorrectly set records
UPDATE alerts 
SET is_resolved = false 
WHERE is_resolved = true AND resolved_at IS NULL;

-- Note: The default is already set correctly in the schema as false
-- This migration just fixes any bad data
