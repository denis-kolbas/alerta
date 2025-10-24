# Braze Backfill Worker

Cloud Function that performs one-time historical data backfill when a new Braze integration is connected.

## Purpose

When a user connects their Braze account, we want to populate historical data instead of starting from zero. This worker fetches the last 30 days of event data by making chunked API calls.

## How It Works

1. **Triggered**: When a new Braze integration is saved, a message is published to `braze-backfill-queue`
2. **Chunked Fetching**: Makes multiple API calls with `length=100` hours each, moving `ending_at` backwards
   - Call 1: Last 100 hours (0-100h ago)
   - Call 2: 100-200 hours ago
   - Call 3: 200-300 hours ago
   - ... continues for 30 days (720 hours total)
3. **Data Storage**: Inserts all historical data points into `event_data` table
4. **Completion Tracking**: Marks `backfill_completed = true` in `clients` table

## Configuration

- **Backfill Period**: 30 days (configurable via `BACKFILL_DAYS`)
- **Chunk Size**: 100 hours (max allowed by Braze API)
- **Timeout**: 9 minutes (longer than regular worker)
- **Memory**: 512Mi

## Deployment

```bash
# Set environment variable
export SUPABASE_CONNECTION_URI="your-connection-string"

# Deploy
./deploy.sh
```

## Monitoring

Check logs in Google Cloud Console:
```bash
gcloud functions logs read braze-backfill-worker --region=us-central1 --limit=50
```

## Database Schema

Requires these columns in `clients` table:
- `backfill_completed` (boolean)
- `backfill_started_at` (timestamp)
- `backfill_completed_at` (timestamp)

Run migration: `migrations/add_backfill_tracking.sql`

## Error Handling

- If individual events fail, they're logged but don't stop the whole backfill
- Partial backfill is marked as completed (some data is better than none)
- Failed backfills can be manually retriggered by publishing to the topic

## Testing

Manually trigger a backfill:
```bash
gcloud pubsub topics publish braze-backfill-queue \
  --message='{"client_id":"uuid-here","brand_name":"Test Brand","instance_url":"rest.iad-01.braze.com","api_key":"your-key"}' \
  --project=gen-lang-client-0044777751
```
