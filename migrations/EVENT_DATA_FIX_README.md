# Event Data Schema Fix: Link to Clients

## What Changed

Added `client_id` and `integration_name` to `event_data` table to properly track which integration the data came from.

### Before (Problem):
```sql
event_data (
  brand VARCHAR -- Just "Bark" - can't distinguish between integrations
)
```

**Issue:** If team "Bark" has Braze AND Mixpanel:
- Both write to `brand='Bark'`
- Can't tell which integration the data came from
- Event names might conflict

### After (Fixed):
```sql
event_data (
  client_id UUID → clients.id,
  brand VARCHAR, -- Keep for backward compatibility
  integration_name VARCHAR, -- 'braze', 'mixpanel', etc.
  event_name VARCHAR,
  timestamp TIMESTAMP,
  count INTEGER
)
```

## Benefits

1. ✅ **Multi-integration support**: Distinguish Braze events from Mixpanel events
2. ✅ **Proper relationships**: Foreign key to clients table
3. ✅ **Queryable**: "Get all Braze events for team X"
4. ✅ **No conflicts**: Event names scoped to integration
5. ✅ **Backward compatible**: Existing data preserved

## Migration Steps

### 1. Run Migration (PRESERVES ALL DATA)
```sql
-- In Supabase SQL Editor
-- Copy contents of: migrations/add_client_to_event_data.sql
```

This will:
- Add `client_id` and `integration_name` columns (nullable)
- Populate them for existing data by matching `brand` with `clients.brand_name`
- Add foreign key constraint
- Add indexes

### 2. Redeploy braze-event-worker
The worker now:
- Looks up `client_id` from clients table
- Inserts with `client_id` and `integration_name='braze'`
- Falls back gracefully if client not found

### 3. Test
- Trigger dispatcher or worker manually
- Check that new event_data rows have `client_id` and `integration_name` populated

## Data Preservation

✅ **ALL existing event_data is preserved**
- Old rows: Have `brand` column, `client_id` will be NULL or populated if match found
- New rows: Have `brand`, `client_id`, and `integration_name`

## Files Updated

### Schema:
- `lib/db/schema.ts` - Added client_id, integration_name, relation

### Backend:
- `lib/db/queries.ts` - Added getEventDataByClient()

### Cloud Functions:
- `gcp/braze-event-worker/main.py` - Lookup client_id, insert with integration_name

## Example Data

**Before:**
```
brand='Bark', event_name='session.start', count=100
```

**After:**
```
client_id='uuid-123', brand='Bark', integration_name='braze', event_name='session.start', count=100
```

## Future: Adding Mixpanel

When you add Mixpanel integration:
1. User connects Mixpanel on integrations page
2. Creates client with `integration_name='mixpanel'`
3. Mixpanel worker inserts with `integration_name='mixpanel'`
4. Analytics can filter by integration: "Show only Braze events" or "Show only Mixpanel events"
