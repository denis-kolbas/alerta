-- Fix event_data unique constraint to use client_id instead of brand
-- This prevents duplicate entries when the same event is processed multiple times

-- Drop old constraint if it exists (based on brand)
ALTER TABLE event_data 
DROP CONSTRAINT IF EXISTS event_data_brand_event_name_timestamp_key;

-- Add new constraint based on client_id
-- This ensures each client can only have one entry per event per timestamp
ALTER TABLE event_data 
ADD CONSTRAINT event_data_client_id_event_name_timestamp_key 
UNIQUE (client_id, event_name, timestamp);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_event_data_client_id_timestamp 
ON event_data (client_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_event_data_client_id_event_name 
ON event_data (client_id, event_name);
