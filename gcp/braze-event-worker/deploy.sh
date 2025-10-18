#!/bin/bash

# Deployment script for braze-event-worker Cloud Function (UPDATED with event analyzer trigger)
# Usage: ./deploy.sh

set -e

PROJECT_ID="gen-lang-client-0044777751"
PROJECT_NUMBER="172985762024"
FUNCTION_NAME="braze-event-worker"
REGION="europe-west1"
TOPIC="braze-event-processing-queue"

echo "🚀 Deploying UPDATED $FUNCTION_NAME to GCP..."
echo "   Project: $PROJECT_ID"
echo "   Region: $REGION"
echo "   Trigger: $TOPIC"
echo "   ⚠️  This version now publishes to alert-analysis-queue"
echo ""

echo "☁️  Deploying function..."
gcloud functions deploy $FUNCTION_NAME \
  --gen2 \
  --runtime=python311 \
  --region=$REGION \
  --source=. \
  --entry-point=braze_event_worker \
  --trigger-topic=$TOPIC \
  --set-secrets=SUPABASE_CONNECTION_URI=projects/$PROJECT_NUMBER/secrets/SUPABASE_CONNECTION_URI:latest \
  --timeout=540s \
  --memory=512MB \
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
echo "🔗 Flow: Dispatcher → Worker → Event Analyzer"
