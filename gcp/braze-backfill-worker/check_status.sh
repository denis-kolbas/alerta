#!/bin/bash

# Check backfill status for all Braze integrations
# Usage: ./check_status.sh

set -e

if [ -z "$SUPABASE_CONNECTION_URI" ]; then
  echo "❌ SUPABASE_CONNECTION_URI environment variable not set"
  exit 1
fi

echo "📊 Backfill Status Report"
echo "=========================="
echo ""

# Check backfill completion status
echo "🔍 Backfill Completion Status:"
psql "$SUPABASE_CONNECTION_URI" -c "
  SELECT 
    brand_name,
    integration_name,
    backfill_completed,
    backfill_started_at,
    backfill_completed_at,
    CASE 
      WHEN backfill_completed_at IS NOT NULL AND backfill_started_at IS NOT NULL 
      THEN ROUND(EXTRACT(EPOCH FROM (backfill_completed_at - backfill_started_at))/60, 2)
      ELSE NULL
    END as duration_minutes
  FROM clients 
  WHERE integration_name = 'braze' AND is_active = true
  ORDER BY backfill_started_at DESC;
"

echo ""
echo "📈 Historical Data Coverage:"
psql "$SUPABASE_CONNECTION_URI" -c "
  SELECT 
    c.brand_name,
    COUNT(DISTINCT e.event_name) as event_count,
    MIN(e.timestamp) as oldest_data,
    MAX(e.timestamp) as newest_data,
    COUNT(*) as total_data_points,
    ROUND(EXTRACT(EPOCH FROM (MAX(e.timestamp) - MIN(e.timestamp)))/3600, 1) as hours_of_data
  FROM clients c
  LEFT JOIN event_data e ON c.id = e.client_id
  WHERE c.integration_name = 'braze' AND c.is_active = true
  GROUP BY c.brand_name
  ORDER BY c.brand_name;
"

echo ""
echo "🔄 Clients Needing Backfill:"
psql "$SUPABASE_CONNECTION_URI" -c "
  SELECT 
    id,
    brand_name,
    created_at,
    backfill_completed
  FROM clients 
  WHERE integration_name = 'braze' 
    AND is_active = true 
    AND backfill_completed = false
  ORDER BY created_at DESC;
"

echo ""
echo "✅ Done!"
