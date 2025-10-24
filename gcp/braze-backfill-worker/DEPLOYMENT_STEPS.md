# Deployment Steps for Braze Backfill Feature

## 1. Install Dependencies

```bash
cd alerta-clean
npm install @google-cloud/pubsub
```

## 2. Run Database Migration

```bash
psql $SUPABASE_CONNECTION_URI -f migrations/add_backfill_tracking.sql
```

Or run directly in Supabase SQL editor:
```sql
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS backfill_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS backfill_started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS backfill_completed_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_clients_backfill_status 
ON clients(backfill_completed, is_active) 
WHERE is_active = true;
```

## 3. Deploy Backfill Worker

```bash
cd gcp/braze-backfill-worker
export SUPABASE_CONNECTION_URI="your-connection-string"
./deploy.sh
```

## 4. Test the Feature

### Option A: Connect a new Braze integration
1. Go to dashboard → Integrations → Braze
2. Enter credentials and save
3. Check logs to see backfill triggered

### Option B: Manually trigger backfill
```bash
# Get a client_id from your database
psql $SUPABASE_CONNECTION_URI -c "SELECT id, brand_name FROM clients WHERE integration_name = 'braze' LIMIT 1;"

# Trigger backfill manually
gcloud pubsub topics publish braze-backfill-queue \
  --message='{"client_id":"<uuid>","brand_name":"<name>","instance_url":"rest.iad-01.braze.com","api_key":"<key>"}' \
  --project=gen-lang-client-0044777751
```

## 5. Monitor Backfill

```bash
# Watch function logs
gcloud functions logs read braze-backfill-worker \
  --region=us-central1 \
  --limit=100 \
  --format="table(time_utc, severity, log)"

# Check backfill status in database
psql $SUPABASE_CONNECTION_URI -c "
  SELECT id, brand_name, backfill_completed, backfill_started_at, backfill_completed_at 
  FROM clients 
  WHERE integration_name = 'braze';
"
```

## 6. Verify Data

```bash
# Check how much historical data was loaded
psql $SUPABASE_CONNECTION_URI -c "
  SELECT 
    c.brand_name,
    COUNT(DISTINCT e.event_name) as event_count,
    MIN(e.timestamp) as oldest_data,
    MAX(e.timestamp) as newest_data,
    COUNT(*) as total_data_points
  FROM clients c
  JOIN event_data e ON c.id = e.client_id
  WHERE c.integration_name = 'braze'
  GROUP BY c.brand_name;
"
```

## Expected Results

- **Backfill Duration**: 2-5 minutes depending on number of events
- **Data Points**: ~720 data points per event (30 days × 24 hours)
- **API Calls**: ~8 calls per event (100 hours per call)
- **Historical Coverage**: Last 30 days

## Troubleshooting

### Backfill not triggered
- Check that `@google-cloud/pubsub` is installed
- Verify GCP credentials are configured
- Check Next.js server logs for errors

### Backfill fails
- Check function logs: `gcloud functions logs read braze-backfill-worker`
- Verify Braze API credentials are correct
- Check if Braze API rate limits are hit

### Partial data
- Backfill marks as completed even with some failures
- Check logs to see which events failed
- Can manually re-trigger for specific client

## Rollback

If needed, rollback the changes:

```sql
-- Remove backfill columns
ALTER TABLE clients 
DROP COLUMN IF EXISTS backfill_completed,
DROP COLUMN IF EXISTS backfill_started_at,
DROP COLUMN IF EXISTS backfill_completed_at;

-- Delete backfill function
gcloud functions delete braze-backfill-worker --region=us-central1

-- Delete topic
gcloud pubsub topics delete braze-backfill-queue
```
