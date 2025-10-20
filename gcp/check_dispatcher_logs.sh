#!/bin/bash

# Check recent dispatcher logs for Klaviyo processing

PROJECT_ID="gen-lang-client-0044777751"
FUNCTION_NAME="braze-event-dispatcher"
REGION="us-central1"

echo "=== Checking Dispatcher Logs for Klaviyo ==="
echo ""

echo "Recent logs (last 50 entries):"
gcloud functions logs read $FUNCTION_NAME \
    --region=$REGION \
    --project=$PROJECT_ID \
    --gen2 \
    --limit=50 \
    --format="table(time, severity, log)" \
    2>/dev/null

echo ""
echo "=== Filtering for Klaviyo mentions ==="
gcloud functions logs read $FUNCTION_NAME \
    --region=$REGION \
    --project=$PROJECT_ID \
    --gen2 \
    --limit=100 \
    2>/dev/null | grep -i klaviyo

echo ""
echo "=== Check complete ==="
