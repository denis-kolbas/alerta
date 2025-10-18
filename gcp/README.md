# Alerta GCP Cloud Functions

Complete event processing and alert system for Braze data.

## Architecture

```
┌─────────────┐
│   Scheduler │ (Hourly)
└──────┬──────┘
       │
       ▼
┌─────────────────────┐
│ braze-event-        │ Reads all active clients
│ dispatcher          │ from database
└──────┬──────────────┘
       │
       │ Publishes to: braze-event-processing-queue
       ▼
┌─────────────────────┐
│ braze-event-        │ Fetches event data from
│ worker              │ Braze API, saves to DB
└──────┬──────────────┘
       │
       │ Publishes to: alert-analysis-queue
       ▼
┌─────────────────────┐
│ event-analyzer      │ Analyzes data, creates
│ (universal)         │ alerts for anomalies
└─────────────────────┘
```

## Components

### 1. braze-event-dispatcher
- **Trigger:** Cloud Scheduler (hourly)
- **Purpose:** Fetch all active clients and dispatch jobs
- **Output:** Publishes to `braze-event-processing-queue`

### 2. braze-event-worker
- **Trigger:** Pub/Sub (`braze-event-processing-queue`)
- **Purpose:** Fetch event data from Braze API and save to database
- **Output:** Publishes to `alert-analysis-queue`

### 3. event-analyzer (NEW - Universal)
- **Trigger:** Pub/Sub (`alert-analysis-queue`)
- **Purpose:** Analyze event data and create alerts for anomalies
- **Works with:** All integrations (Braze, Mixpanel, Klaviyo, etc.)
- **Rules:**
  - Silence Detection: Event silent longer than normal
  - Spike Detection: Event count higher than normal
  - Drop Detection: Event count lower than normal

## Deployment Order

Deploy in this order to ensure dependencies are met:

### 1. Deploy Event Analyzer (NEW)
```bash
cd event-analyzer
./deploy.sh
```

### 2. Re-deploy Worker (UPDATED)
```bash
cd braze-event-worker
./deploy.sh
```

### 3. Dispatcher (No changes needed)
Already deployed, no changes required.

## Testing the Complete Flow

### Test End-to-End

Trigger the dispatcher manually:
```bash
gcloud pubsub topics publish dispatcher-trigger \
  --message='{"trigger":"manual"}' \
  --project=gen-lang-client-0044777751
```

This will:
1. Dispatcher reads clients
2. Worker fetches event data
3. Alert analyzer checks for anomalies
4. Alerts created in database

### Test Event Analyzer Only

```bash
gcloud pubsub topics publish alert-analysis-queue \
  --message='{"brand_name":"Bark","events_processed":["session.start","session.end"],"timestamp":"2024-10-18T12:00:00Z"}' \
  --project=gen-lang-client-0044777751
```

### View Alerts Created

```sql
SELECT 
  id,
  brand_name,
  event_name,
  rule_type,
  severity,
  message,
  created_at,
  is_resolved
FROM alerts
ORDER BY created_at DESC
LIMIT 10;
```

## Monitoring

### View All Function Logs
```bash
# Dispatcher
gcloud functions logs read braze-event-dispatcher --gen2 --region=us-central1 --project=gen-lang-client-0044777751 --limit=20

# Worker
gcloud functions logs read braze-event-worker --gen2 --region=us-central1 --project=gen-lang-client-0044777751 --limit=20

# Event Analyzer
gcloud functions logs read event-analyzer --gen2 --region=us-central1 --project=gen-lang-client-0044777751 --limit=20
```

### Check Pub/Sub Topics
```bash
gcloud pubsub topics list --project=gen-lang-client-0044777751
```

### Check Subscriptions
```bash
gcloud pubsub subscriptions list --project=gen-lang-client-0044777751
```

## Environment Variables

All functions use:
- `SUPABASE_CONNECTION_URI` - Database connection string

## Configuration

### Event Analyzer Settings (in main.py)
- `ANALYSIS_WINDOW_HOURS = 168` - Look back 7 days
- `MIN_DATA_POINTS = 24` - Require 24 hours minimum

### Alert Rules
- **Silence:** Triggers at 1.5x max historical silence
- **Spike:** Triggers at avg + 3 * stddev
- **Drop:** Triggers at avg - 3 * stddev

## Troubleshooting

### Worker not triggering analyzer
Check worker logs for "Published to event analyzer" message:
```bash
gcloud functions logs read braze-event-worker --gen2 --region=us-central1 --project=gen-lang-client-0044777751 | grep "event analyzer"
```

### No alerts being created
1. Check if events have enough data (24+ hours)
2. Check analyzer logs for "Insufficient data" messages
3. Verify alerts table exists in database

### Database connection issues
Test connection:
```bash
psql "postgresql://postgres.gxxfwgajcupunjfcpmfs:Yynqocu3h.a@aws-1-us-east-2.pooler.supabase.com:6543/postgres"
```

## Cost Optimization

- Functions use 512MB memory (can reduce if needed)
- Max 10 instances per function
- 540s timeout (9 minutes)

Estimated cost: ~$5-10/month for hourly runs with 5-10 clients
