#!/bin/bash

# Deploy Braze Backfill Worker to Google Cloud Functions (Gen 2)

set -e

FUNCTION_NAME="braze-backfill-worker"
REGION="us-central1"
PROJECT_ID="gen-lang-client-0044777751"
TOPIC_NAME="braze-backfill-queue"
RUNTIME="python311"
ENTRY_POINT="braze_backfill_worker"
MEMORY="512Mi"
TIMEOUT="120s"  # 2 minutes (each job backfills ONE event, ~8-10 seconds typical)
MAX_INSTANCES="5"  # Limit concurrency to avoid Braze API rate limits

echo "🚀 Deploying $FUNCTION_NAME to Google Cloud Functions (Gen 2)..."

# Create Pub/Sub topic if it doesn't exist
if ! gcloud pubsub topics describe $TOPIC_NAME --project=$PROJECT_ID &>/dev/null; then
  echo "📬 Creating Pub/Sub topic: $TOPIC_NAME"
  gcloud pubsub topics create $TOPIC_NAME --project=$PROJECT_ID
else
  echo "✅ Pub/Sub topic already exists: $TOPIC_NAME"
fi

# Deploy the function
gcloud functions deploy $FUNCTION_NAME \
  --gen2 \
  --runtime=$RUNTIME \
  --region=$REGION \
  --source=. \
  --entry-point=$ENTRY_POINT \
  --trigger-topic=$TOPIC_NAME \
  --memory=$MEMORY \
  --timeout=$TIMEOUT \
  --max-instances=$MAX_INSTANCES \
  --set-env-vars SUPABASE_CONNECTION_URI="$SUPABASE_CONNECTION_URI" \
  --project=$PROJECT_ID \
  --no-allow-unauthenticated

echo "✅ Deployment complete!"
echo "📊 Function: $FUNCTION_NAME"
echo "📍 Region: $REGION"
echo "📬 Trigger: $TOPIC_NAME"
echo "⏱️  Timeout: $TIMEOUT"
