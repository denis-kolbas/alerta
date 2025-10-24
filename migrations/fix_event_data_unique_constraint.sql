-- Fix unique constraint to use client_id instead of brand
-- This makes the constraint work with the backfill worker's ON CONFLICT clause

-- Drop old constraint (if exists)
ALTER TABLE event_data DROP CONSTRAINT IF EXISTS event_data_brand_event_name_timestamp_key;

-- Add new constraint using client_id
ALTER TABLE event_data ADD CONSTRAINT event_data_client_event_timestamp_unique 
  UNIQUE (client_id, event_name, timestamp);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_event_data_client_event_timestamp 
ON event_data(client_id, event_name, timestamp);
