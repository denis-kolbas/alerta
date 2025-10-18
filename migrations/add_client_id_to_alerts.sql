-- Add client_id foreign key to alerts table

-- Step 1: Add the column (nullable first)
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS client_id UUID;

-- Step 2: Populate client_id from brand_name
UPDATE alerts 
SET client_id = clients.id
FROM clients
WHERE alerts.brand_name = clients.brand_name;

-- Step 3: Make it NOT NULL and add foreign key constraint
ALTER TABLE alerts 
  ALTER COLUMN client_id SET NOT NULL,
  ADD CONSTRAINT alerts_client_id_fkey 
    FOREIGN KEY (client_id) 
    REFERENCES clients(id) 
    ON DELETE CASCADE;

-- Step 4: Add index for performance
CREATE INDEX IF NOT EXISTS idx_alerts_client_id ON alerts(client_id);

-- Note: We keep brand_name column for convenience (denormalized)
-- This avoids joins in most queries
