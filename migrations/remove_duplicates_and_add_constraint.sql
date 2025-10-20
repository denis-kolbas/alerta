-- Remove duplicate entries and add unique constraint
-- This fixes the issue where Klaviyo/Braze workers inserted duplicate data

-- Step 1: Find and remove duplicates, keeping only the entry with the highest id
WITH duplicates AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY client_id, event_name, timestamp 
      ORDER BY id DESC
    ) as rn
  FROM event_data
)
DELETE FROM event_data
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Step 2: Drop old constraint if it exists (based on brand)
ALTER TABLE event_data 
DROP CONSTRAINT IF EXISTS event_data_brand_event_name_timestamp_key;

-- Step 3: Add new constraint based on client_id
ALTER TABLE event_data 
ADD CONSTRAINT event_data_client_id_event_name_timestamp_key 
UNIQUE (client_id, event_name, timestamp);

-- Step 4: Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_event_data_client_id_timestamp 
ON event_data (client_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_event_data_client_id_event_name 
ON event_data (client_id, event_name);

-- Step 5: Show summary
DO $$
DECLARE
  total_records INTEGER;
  unique_combinations INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_records FROM event_data;
  SELECT COUNT(DISTINCT (client_id, event_name, timestamp)) INTO unique_combinations FROM event_data;
  
  RAISE NOTICE 'Migration complete!';
  RAISE NOTICE 'Total records: %', total_records;
  RAISE NOTICE 'Unique combinations: %', unique_combinations;
  RAISE NOTICE 'Duplicates removed: %', total_records - unique_combinations;
END $$;
