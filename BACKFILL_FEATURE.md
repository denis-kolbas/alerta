# Historical Data Backfill Feature

## Overview

When users connect a new Braze integration, we now automatically backfill the last 30 days of historical event data instead of starting from zero. This gives users immediate insights and context.

## Architecture

```
User Connects Braze
       ↓
Save Integration (actions.ts)
       ↓
Publish to braze-backfill-queue
       ↓
Backfill Worker (GCP Function)
       ↓
Fetch 30 days in chunks (100h each)
       ↓
Store in event_data table
       ↓
Mark backfill_completed = true
```

## Key Components

### 1. Database Schema (`migrations/add_backfill_tracking.sql`)
- `backfill_completed` - Boolean flag to track completion
- `backfill_started_at` - When backfill began
- `backfill_completed_at` - When backfill finished

### 2. Backfill Worker (`gcp/braze-backfill-worker/`)
- **Trigger**: Pub/Sub message on `braze-backfill-queue`
- **Strategy**: Fetch data in 100-hour chunks, moving backwards
- **Coverage**: 30 days (720 hours) = ~8 API calls per event
- **Timeout**: 9 minutes (longer than regular hourly worker)

### 3. Integration Action (`app/dashboard/integrations/braze/actions.ts`)
- Triggers backfill when new integration is saved
- Non-blocking: Backfill failure doesn't prevent integration save

## How It Works

### Chunked Backfill Strategy

The Braze API has a `length` parameter (max 100 hours). We make multiple calls:

```python
# Call 1: Last 100 hours
ending_at = now
length = 100  # Hours 0-100

# Call 2: Previous 100 hours  
ending_at = now - 100 hours
length = 100  # Hours 100-200

# Call 3: Previous 100 hours
ending_at = now - 200 hours
length = 100  # Hours 200-300

# ... continue for 30 days (720 hours)
```

### Example Timeline

For a user connecting on **Jan 15, 2025 at 3pm**:

- Chunk 1: Jan 15 3pm → Jan 11 11am (100 hours)
- Chunk 2: Jan 11 11am → Jan 7 7am (100 hours)
- Chunk 3: Jan 7 7am → Jan 3 3am (100 hours)
- ... continues back to Dec 16, 2024

## Benefits

1. **Immediate Value** - Users see 30 days of data right away
2. **Better Anomaly Detection** - Analyzer has historical context
3. **One-Time Operation** - Only runs once per integration
4. **Non-Blocking** - Doesn't slow down integration setup
5. **Resilient** - Partial failures don't stop the whole backfill

## Deployment

See `gcp/braze-backfill-worker/DEPLOYMENT_STEPS.md` for full instructions.

Quick start:
```bash
# 1. Install dependencies
npm install @google-cloud/pubsub

# 2. Run migration
psql $SUPABASE_CONNECTION_URI -f migrations/add_backfill_tracking.sql

# 3. Deploy worker
cd gcp/braze-backfill-worker
export SUPABASE_CONNECTION_URI="your-connection-string"
./deploy.sh
```

## Monitoring

### Check Backfill Status
```sql
SELECT 
  brand_name,
  backfill_completed,
  backfill_started_at,
  backfill_completed_at,
  EXTRACT(EPOCH FROM (backfill_completed_at - backfill_started_at))/60 as duration_minutes
FROM clients 
WHERE integration_name = 'braze';
```

### View Historical Data Coverage
```sql
SELECT 
  c.brand_name,
  COUNT(DISTINCT e.event_name) as events,
  MIN(e.timestamp) as oldest_data,
  MAX(e.timestamp) as newest_data,
  COUNT(*) as total_data_points
FROM clients c
JOIN event_data e ON c.id = e.client_id
WHERE c.integration_name = 'braze'
GROUP BY c.brand_name;
```

### Watch Logs
```bash
gcloud functions logs read braze-backfill-worker \
  --region=us-central1 \
  --limit=100
```

## Future Enhancements

- [ ] Add UI indicator showing "Backfilling..." status
- [ ] Support backfill for other integrations (Mixpanel, Klaviyo)
- [ ] Allow users to choose backfill period (7, 14, 30, 60 days)
- [ ] Retry mechanism for failed backfills
- [ ] Progress tracking (X% complete)

## Configuration

Edit `gcp/braze-backfill-worker/main.py`:

```python
BACKFILL_DAYS = 30  # Change to 7, 14, 60, etc.
CHUNK_SIZE_HOURS = 100  # Max allowed by Braze API
```

## Cost Estimate

Per integration:
- **API Calls**: ~8 calls per event × number of events
- **Function Runtime**: 2-5 minutes
- **Storage**: ~720 rows per event (30 days × 24 hours)

Example: 50 events = 400 API calls, ~36,000 data points
