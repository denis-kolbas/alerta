-- Add backfill tracking columns to clients table
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS backfill_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS backfill_started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS backfill_completed_at TIMESTAMP WITH TIME ZONE;

-- Add index for querying clients that need backfill
CREATE INDEX IF NOT EXISTS idx_clients_backfill_status 
ON clients(backfill_completed, is_active) 
WHERE is_active = true;
