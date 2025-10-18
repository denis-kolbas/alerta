# Klaviyo Event Worker - Cloud Function Deployment

## Overview
This Cloud Function fetches hourly event counts from Klaviyo and stores them in the database.

## Manual Deployment Steps

### 1. Create the Cloud Function

1. Go to Google Cloud Console > Cloud Functions
2. Click "CREATE FUNCTION"
3. Configure:
   - **Environment**: 2nd gen
   - **Function name**: `klaviyo-event-worker`
   - **Region**: `us-central1` (or your preferred region)
   - **Trigger type**: Cloud Pub/Sub
   - **Topic**: Create new topic `klaviyo-event-processing-queue` (or use existing)

### 2. Runtime Configuration

**Runtime, build, connections and security settings:**
- **Memory**: 512 MB
- **Timeout**: 540 seconds (9 minutes)
- **Runtime service account**: Default or create dedicated service account

**Environment Variables:**
```
SUPABASE_CONNECTION_URI=postgresql://postgres.xxx:password@aws-1-us-east-2.pooler.supabase.com:6543/postgres
```

### 3. Code Deployment

**Runtime**: Python 3.11

**Entry point**: `klaviyo_event_worker`

**Source code**: Upload the following files:
- `main.py`
- `requirements.txt`

Or use inline editor and copy/paste the contents.

### 4. Deploy

Click "DEPLOY" and wait for deployment to complete (2-3 minutes).

## Testing the Function

### Test with gcloud CLI:

```bash
gcloud pubsub topics publish klaviyo-event-processing-queue \
  --message '{
    "brand_name": "YourBrand",
    "klaviyo_api_key": "pk_your_api_key_here",
    "hours_back": 2
  }'
```

### Test from Cloud Console:

1. Go to Cloud Functions > klaviyo-event-worker
2. Click "TESTING" tab
3. Use this test message:

```json
{
  "brand_name": "YourBrand",
  "klaviyo_api_key": "pk_your_api_key_here",
  "hours_back": 2
}
```

## Setting Up Scheduler (Optional)

To run this hourly automatically:

1. Go to Cloud Scheduler
2. Create job:
   - **Name**: `klaviyo-hourly-fetch`
   - **Frequency**: `0 * * * *` (every hour)
   - **Timezone**: Your timezone
   - **Target**: Pub/Sub
   - **Topic**: `klaviyo-event-processing-queue`
   - **Message body**:
   ```json
   {
     "brand_name": "YourBrand",
     "klaviyo_api_key": "pk_your_api_key_here",
     "hours_back": 2
   }
   ```

## Message Format

The function expects a Pub/Sub message with:

```json
{
  "brand_name": "YourBrand",           // Your brand name (must match clients table)
  "klaviyo_api_key": "pk_xxx",         // Klaviyo Private API Key
  "hours_back": 2                      // How many hours of data to fetch (default: 2)
}
```

## Monitoring

View logs:
```bash
gcloud functions logs read klaviyo-event-worker --limit 50
```

Or in Cloud Console:
- Cloud Functions > klaviyo-event-worker > LOGS tab

## Rate Limits

The function respects Klaviyo's rate limits:
- 1 second delay between metric-aggregate requests
- ~60 requests per minute
- For 100 metrics, expect ~2 minutes runtime

## Database Schema

The function inserts data into the `event_data` table:

```sql
INSERT INTO event_data (client_id, brand, integration_name, event_name, timestamp, count)
VALUES (uuid, 'YourBrand', 'klaviyo', 'Opened Email', '2025-10-18T14:00:00+00:00', 1234);
```

## Troubleshooting

**"Client not found" error:**
- Ensure a client exists in the `clients` table with:
  - `brand_name` matching the message
  - `integration_name = 'klaviyo'`
  - `is_active = true`

**Rate limit errors:**
- The function includes 1s delays between requests
- If you hit limits, increase `RATE_LIMIT_DELAY` in main.py

**Timeout errors:**
- Increase function timeout (max 540s for 2nd gen)
- Reduce `hours_back` to fetch less data
- Consider splitting into multiple jobs for many metrics
