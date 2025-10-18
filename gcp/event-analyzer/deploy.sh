#!/bin/bash

# Deployment script for event-analyzer Cloud Function
# Usage: ./deploy.sh

set -e

PROJECT_ID="gen-lang-client-0044777751"
PROJECT_NUMBER="172985762024"
FUNCTION_NAME="event-analyzer"
REGION="europe-west1"
TOPIC="alert-analysis-queue"

echo "🚀 Deploying $FUNCTION_NAME to GCP..."
echo "   Project: $PROJECT_ID"
echo "   Region: $REGION"
echo "   Trigger: $TOPIC"
echo "   Universal analyzer for all integrations"
echo ""

# Check if topic exists, create if not
echo "📡 Checking Pub/Sub topic..."
if ! gcloud pubsub topics describe $TOPIC --project=$PROJECT_ID &>/dev/null; then
    echo "   Creating topic: $TOPIC"
    gcloud pubsub topics create $TOPIC --project=$PROJECT_ID
else
    echo "   Topic exists: $TOPIC"
fi

echo ""
echo "☁️  Deploying function..."
gcloud functions deploy $FUNCTION_NAME \
  --gen2 \
  --runtime=python311 \
  --region=$REGION \
  --source=. \
  --entry-point=event_analyzer \
  --trigger-topic=$TOPIC \
  --set-secrets=SUPABASE_CONNECTION_URI=projects/$PROJECT_NUMBER/secrets/SUPABASE_CONNECTION_URI:latest \
  --timeout=540s \
  --memory=1024MB \
  --max-instances=10 \
  --project=$PROJECT_ID

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📊 View function:"
echo "   https://console.cloud.google.com/functions/details/$REGION/$FUNCTION_NAME?project=$PROJECT_ID"
echo ""
echo "📝 View logs:"
echo "   gcloud functions logs read $FUNCTION_NAME --gen2 --region=$REGION --project=$PROJECT_ID --limit=50"
echo ""
echo "🧪 Test function:"
echo "   gcloud pubsub topics publish $TOPIC --message='{\"brand_name\":\"Bark\",\"events_processed\":[\"session.start\"],\"timestamp\":\"2024-10-18T12:00:00Z\"}' --project=$PROJECT_ID"
