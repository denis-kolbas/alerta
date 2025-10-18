# Schema Fix: Proper Team-Client Relationship

## What Changed

Fixed the database schema to properly link `clients` (integrations) to `teams` (organizations).

### Before (Problems):
- ❌ No foreign key between teams and clients
- ❌ Only connected by string matching `brand_name = team.name`
- ❌ `brand_name` was unique (couldn't have multiple integrations)
- ❌ No referential integrity

### After (Fixed):
- ✅ `clients.team_id` foreign key to `teams.id`
- ✅ `clients.integration_name` column ('braze', 'mixpanel', 'klaviyo')
- ✅ One team can have multiple integrations (one per platform)
- ✅ Proper cascade delete
- ✅ Unique constraint: one active integration per platform per team

## New Schema

```sql
clients (
  id UUID PRIMARY KEY,
  team_id INTEGER → teams.id (CASCADE DELETE),
  integration_name VARCHAR(50), -- 'braze', 'mixpanel', etc.
  brand_name TEXT, -- Team name (for backward compatibility)
  braze_instance_url TEXT,
  braze_api_key BYTEA,
  is_active BOOLEAN,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  UNIQUE (team_id, integration_name) WHERE is_active = true
)
```

## Migration Steps

1. **Run migration** (wipes clients and alerts, keeps event_data):
   ```sql
   -- In Supabase SQL Editor
   -- Copy contents of: migrations/fix_clients_schema.sql
   ```

2. **Redeploy event-analyzer** (already updated with client_id lookup)

3. **Test integration flow:**
   - Go to /dashboard/integrations
   - Click "Connect" on Braze
   - Fill in instance URL and API key
   - Save
   - Should create client with proper team_id and integration_name

## What's Preserved

- ✅ `event_data` table - ALL historical data intact
- ✅ `teams` table - No changes
- ✅ `users` table - No changes

## What's Reset

- ⚠️ `clients` table - Fresh start (need to reconnect integrations)
- ⚠️ `alerts` table - Fresh start (will regenerate on next run)

## Files Updated

### Schema:
- `lib/db/schema.ts` - Added team_id, integration_name, relations

### Backend:
- `app/dashboard/integrations/braze/actions.ts` - Save by team_id + integration_name
- `app/dashboard/integrations/actions.ts` - Disconnect by team_id + integration_name
- `app/dashboard/integrations/page.tsx` - Check connections by team_id

### Cloud Functions:
- `gcp/event-analyzer/main.py` - Lookup client_id before creating alerts

## Benefits

1. **Multi-integration support**: One team can have Braze + Mixpanel + Klaviyo
2. **Data integrity**: Foreign keys enforce relationships
3. **Cascade delete**: Delete team → auto-delete integrations and alerts
4. **Scalable**: Easy to add new integration types
5. **Queryable**: Can easily get "all integrations for team X"
