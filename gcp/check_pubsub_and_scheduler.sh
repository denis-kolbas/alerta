#!/bin/bash

PROJECT_ID="gen-lang-client-0044777751"
TOPIC_NAME="klaviyo-event-processing-queue"

echo "=== Checking Pub/Sub and Scheduler Configuration ==="
echo ""

echo "1. Checking Cloud Scheduler jobs that might trigger Klaviyo:"
gcloud scheduler jobs list --project=$PROJECT_ID --format="table(name, schedule, state, pubsubTarget.topicName)" | grep -i klaviyo || echo "No Klaviyo scheduler jobs found"
echo ""

echo "2. Checking all scheduler jobs:"
gcloud scheduler jobs list --project=$PROJECT_ID --format="table(name, schedule, state, pubsubTarget.topicName)"
echo ""

echo "3. Checking Pub/Sub topic subscriptions:"
gcloud pubsub topics list-subscriptions $TOPIC_NAME --project=$PROJECT_ID 2>/dev/null || echo "Topic not found or no subscriptions"
echo ""

echo "4. Checking for unacknowledged messages in topic:"
gcloud pubsub subscriptions list --project=$PROJECT_ID --format="table(name, topic, ackDeadlineSeconds, messageRetentionDuration)" | grep -i klaviyo || echo "No subscriptions found"
echo ""

echo "5. Recent function invocations (last 20):"
gcloud functions logs read klaviyo-event-worker \
    --region=us-central1 \
    --project=$PROJECT_ID \
    --gen2 \
    --limit=100 \
    2>/dev/null | grep "Received job" | tail -20
echo ""

echo "=== Diagnosis ==="
echo "If you see a scheduler job running every minute, that's the issue."
echo "If you see the same 'Received job' repeatedly, the message isn't being acknowledged."
echo ""
echo "To pause a scheduler job:"
echo "gcloud scheduler jobs pause JOB_NAME --project=$PROJECT_ID"
