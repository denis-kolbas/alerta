-- Add client_id and integration_name to event_data table
-- PRESERVES ALL EXISTING DATA

-- Step 1: Add new columns (nullable first to preserve existing data)
ALTER TABLE event_data 
  ADD COLUMN IF NOT EXISTS client_id UUID,
  ADD COLUMN IF NOT EXISTS integration_name VARCHAR(50);

-- Step 2: Populate client_id and integration_name for existing data
-- This matches existing event_data.brand with clients.brand_name
UPDATE event_data 
SET 
  client_id = clients.id,
  integration_name = clients.integration_name
FROM clients
WHERE event_data.brand = clients.brand_name
  AND event_data.client_id IS NULL;

-- Step 3: Add foreign key constraint (allows NULL for backward compatibility)
ALTER TABLE event_data
  ADD CONSTRAINT event_data_client_id_fkey 
    FOREIGN KEY (client_id) 
    REFERENCES clients(id) 
    ON DELETE CASCADE;

-- Step 4: Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_event_data_client_id ON event_data(client_id);
CREATE INDEX IF NOT EXISTS idx_event_data_integration ON event_data(integration_name);
CREATE INDEX IF NOT EXISTS idx_event_data_client_event ON event_data(client_id, event_name);

-- Note: We keep columns nullable for backward compatibility
-- New data from workers will have client_id populated
-- Old data keeps working with brand column
