# Event Analyzer - Cloud Function

This function analyzes event data and creates alerts for anomalies (silence, spikes, drops).
Works with all integrations (Braze, Mixpanel, Klaviyo, etc.)

## Prerequisites

1. GCP Project: `gen-lang-client-0044777751`
2. Pub/Sub topic created: `alert-analysis-queue`
3. Database table `alerts` created (see migrations)

## Deployment Instructions

### Step 1: Create Pub/Sub Topic

```bash
gcloud pubsub topics create alert-analysis-queue \
  --project=gen-lang-client-0044777751
```

### Step 2: Deploy Cloud Function

```bash
gcloud functions deploy event-analyzer \
  --gen2 \
  --runtime=python311 \
  --region=us-central1 \
  --source=. \
  --entry-point=event_analyzer \
  --trigger-topic=alert-analysis-queue \
  --set-env-vars=SUPABASE_CONNECTION_URI="postgresql://postgres.gxxfwgajcupunjfcpmfs:Yynqocu3h.a@aws-1-us-east-2.pooler.supabase.com:6543/postgres" \
  --timeout=540s \
  --memory=512MB \
  --max-instances=10 \
  --project=gen-lang-client-0044777751
```

### Step 3: Verify Deployment

Check function status:
```bash
gcloud functions describe event-analyzer \
  --gen2 \
  --region=us-central1 \
  --project=gen-lang-client-0044777751
```

View logs:
```bash
gcloud functions logs read event-analyzer \
  --gen2 \
  --region=us-central1 \
  --project=gen-lang-client-0044777751 \
  --limit=50
```

### Step 4: Test the Function

Publish a test message:
```bash
gcloud pubsub topics publish alert-analysis-queue \
  --message='{"brand_name":"Bark","events_processed":["session.start","session.end"],"timestamp":"2024-10-18T12:00:00Z"}' \
  --project=gen-lang-client-0044777751
```

Then check logs to see if it processed correctly.

## Configuration

### Environment Variables

- `SUPABASE_CONNECTION_URI` - Database connection string (set during deployment)

### Constants (in main.py)

- `ANALYSIS_WINDOW_HOURS = 168` - Look back 7 days for baseline
- `MIN_DATA_POINTS = 24` - Require 24 hours of data minimum

## Alert Rules

### Rule 1: Silence Detection
- Triggers when event is zero for longer than 1.5x historical max silence
- Severity: `warning` (1.5x-2x) or `critical` (2x+)

### Rule 2: Spike Detection
- Triggers when count > (avg + 3 * stddev)
- Severity: `warning`

### Rule 3: Drop Detection
- Triggers when count < (avg - 3 * stddev) and count > 0
- Severity: `warning`

## Auto-Resolution

Alerts automatically resolve when the condition clears:
- Silence alert resolves when event becomes active again
- Spike alert resolves when count returns to normal
- Drop alert resolves when count returns to normal

## Monitoring

View function metrics in GCP Console:
https://console.cloud.google.com/functions/details/us-central1/event-analyzer?project=gen-lang-client-0044777751

Key metrics to watch:
- Execution count
- Error rate
- Execution time
- Memory usage

## Troubleshooting

### Function not triggering
```bash
# Check if topic exists
gcloud pubsub topics list --project=gen-lang-client-0044777751

# Check if subscription exists
gcloud pubsub subscriptions list --project=gen-lang-client-0044777751
```

### Database connection errors
```bash
# Test connection from Cloud Shell
psql "postgresql://postgres.gxxfwgajcupunjfcpmfs:Yynqocu3h.a@aws-1-us-east-2.pooler.supabase.com:6543/postgres"
```

### View detailed logs
```bash
gcloud functions logs read event-analyzer \
  --gen2 \
  --region=us-central1 \
  --project=gen-lang-client-0044777751 \
  --limit=100 \
  --format=json
```
