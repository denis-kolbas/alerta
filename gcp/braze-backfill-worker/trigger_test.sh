#!/bin/bash

# Test script to manually trigger a backfill job
# Usage: ./trigger_test.sh

set -e

# Configuration
PROJECT_ID="gen-lang-client-0044777751"
TOPIC_NAME="braze-backfill-queue"

# Get these from your database or pass as arguments
CLIENT_ID="${1:-}"
BRAND_NAME="${2:-}"
INSTANCE_URL="${3:-}"
API_KEY="${4:-}"

if [ -z "$CLIENT_ID" ] || [ -z "$BRAND_NAME" ] || [ -z "$INSTANCE_URL" ] || [ -z "$API_KEY" ]; then
  echo "❌ Missing required parameters"
  echo ""
  echo "Usage: $0 <client_id> <brand_name> <instance_url> <api_key>"
  echo ""
  echo "Example:"
  echo "  $0 'abc-123-def' 'My Brand' 'rest.iad-01.braze.com' 'your-api-key'"
  echo ""
  echo "Or query your database to get a client:"
  echo "  psql \$SUPABASE_CONNECTION_URI -c \"SELECT id, brand_name, braze_instance_url FROM clients WHERE integration_name = 'braze' LIMIT 1;\""
  exit 1
fi

echo "🚀 Triggering backfill for:"
echo "   Client ID: $CLIENT_ID"
echo "   Brand: $BRAND_NAME"
echo "   Instance: $INSTANCE_URL"
echo ""

# Create message payload
MESSAGE=$(cat <<EOF
{
  "client_id": "$CLIENT_ID",
  "brand_name": "$BRAND_NAME",
  "instance_url": "$INSTANCE_URL",
  "api_key": "$API_KEY"
}
EOF
)

# Publish to Pub/Sub
gcloud pubsub topics publish $TOPIC_NAME \
  --message="$MESSAGE" \
  --project=$PROJECT_ID

echo "✅ Backfill job triggered!"
echo ""
echo "Monitor logs with:"
echo "  gcloud functions logs read braze-backfill-worker --region=us-central1 --limit=50"
echo ""
echo "Check status in database:"
echo "  psql \$SUPABASE_CONNECTION_URI -c \"SELECT brand_name, backfill_completed, backfill_started_at, backfill_completed_at FROM clients WHERE id = '$CLIENT_ID';\""
