#!/bin/bash

# Trigger braze-event-worker for testing
# This publishes a message to the braze-event-processing-queue topic

# Get Braze credentials from your database or .env
CLIENT_ID="6a3e98aa-053c-4e6a-a791-e4a6039f6b97"
BRAND_NAME="LARQ"
INSTANCE_URL="rest.iad-03.braze.com"
API_KEY="b92934dc-4576-4724-a2b1-4a1ec72a64ac"  # Replace with actual API key

MESSAGE=$(cat <<EOF
{
  "client_id": "$CLIENT_ID",
  "brand_name": "$BRAND_NAME",
  "integration_type": "braze",
  "instance_url": "$INSTANCE_URL",
  "api_key": "$API_KEY"
}
EOF
)

echo "Publishing message to braze-event-processing-queue..."
echo "$MESSAGE"

gcloud pubsub topics publish braze-event-processing-queue \
  --message="$MESSAGE"

echo ""
echo "✅ Message published!"
echo "Check logs with:"
echo "gcloud functions logs read braze-event-worker --gen2 --region=europe-west1 --limit=50"
