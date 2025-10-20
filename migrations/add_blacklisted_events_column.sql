-- Add blacklisted_events column to clients table
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS blacklisted_events JSONB DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN clients.blacklisted_events IS 'Array of event names to exclude from monitoring';
