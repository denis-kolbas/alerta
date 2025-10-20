"""
Klaviyo Event Fetcher
Fetches all metrics (events) and their hourly counts from Klaviyo API
"""

import requests
import json
from datetime import datetime, timedelta, timezone
import os
from pathlib import Path
from dotenv import load_dotenv
import time

# Load environment variables from root .env file
root_dir = Path(__file__).parent.parent.parent
load_dotenv(root_dir / '.env')

# Configuration
KLAVIYO_API_KEY = os.getenv('KLAVIYO_API_KEY')
KLAVIYO_API_BASE = 'https://a.klaviyo.com/api'
REVISION = '2025-10-15'

# Rate limiting for metric-aggregates endpoint: 3/s burst, 60/m steady
# We'll use 2 requests per second to be safe (120/minute is over the 60/m limit)
RATE_LIMIT_DELAY = 1.0  # 1 second between requests = 60/minute

def get_headers():
    """Get headers for Klaviyo API requests"""
    return {
        'Authorization': f'Klaviyo-API-Key {KLAVIYO_API_KEY}',
        'revision': REVISION,
        'Content-Type': 'application/json'
    }

def get_all_metrics():
    """
    Fetch all metrics (events) from Klaviyo with pagination support
    
    The API returns a maximum of 200 metrics per page, so we paginate through all results.
    """
    url = f'{KLAVIYO_API_BASE}/metrics'
    headers = get_headers()
    
    all_metrics = []
    next_cursor = None
    page = 1
    
    while True:
        params = {}
        if next_cursor:
            params['page[cursor]'] = next_cursor
        
        response = requests.get(url, headers=headers, params=params)
        
        if response.status_code != 200:
            print(f"Error fetching metrics: {response.status_code}")
            print(response.text)
            break
        
        data = response.json()
        metrics = data.get('data', [])
        all_metrics.extend(metrics)
        
        print(f"Fetched page {page}: {len(metrics)} metrics (total: {len(all_metrics)})")
        
        # Check for next page
        links = data.get('links', {})
        if 'next' in links and links['next']:
            # Extract cursor from next URL or query params
            next_url = links['next']
            if 'page[cursor]=' in next_url:
                next_cursor = next_url.split('page[cursor]=')[-1].split('&')[0]
            else:
                break
            page += 1
        else:
            break
    
    return all_metrics

def query_metric_aggregates(metric_id, metric_name, hours_back=1):
    """
    Query aggregated event counts for a specific metric
    
    Args:
        metric_id: The Klaviyo metric ID
        metric_name: The metric name for logging
        hours_back: How many hours back to query (default 1)
    """
    url = f'{KLAVIYO_API_BASE}/metric-aggregates'
    headers = get_headers()
    
    # Calculate time range - EXACTLY like the worker does
    current_time = datetime.now(timezone.utc)
    end_time = current_time.replace(minute=0, second=0, microsecond=0)
    start_time = end_time - timedelta(hours=hours_back)
    
    # Format timestamps for Klaviyo API
    start_str = start_time.strftime('%Y-%m-%dT%H:%M:%S')
    end_str = end_time.strftime('%Y-%m-%dT%H:%M:%S')
    
    payload = {
        "data": {
            "type": "metric-aggregate",
            "attributes": {
                "measurements": ["count"],
                "filter": [
                    f"greater-or-equal(datetime,{start_str})",
                    f"less-than(datetime,{end_str})"
                ],
                "metric_id": metric_id,
                "interval": "hour",
                "timezone": "UTC"
            }
        }
    }
    
    # Debug: print the request for first metric
    if not hasattr(query_metric_aggregates, '_printed_example'):
        print("\n" + "="*60)
        print("EXAMPLE REQUEST (EXACTLY AS WORKER SENDS):")
        print("="*60)
        print(f"Current time: {current_time.isoformat()}")
        print(f"End time (rounded to hour): {end_time.isoformat()}")
        print(f"Start time (end - {hours_back}h): {start_time.isoformat()}")
        print(f"\nURL: POST {url}")
        print(f"Body: {json.dumps(payload, indent=2)}")
        print("="*60 + "\n")
        query_metric_aggregates._printed_example = True
    
    response = requests.post(url, headers=headers, json=payload)
    
    if response.status_code != 200:
        print(f"Error querying metric {metric_name} ({metric_id}): {response.status_code}")
        print(f"Response: {response.text}")
        return None
    
    return response.json()

def process_aggregate_response(response_data, metric_name):
    """
    Process the aggregate response and extract hourly counts
    
    Returns list of dicts with timestamp and count
    """
    if not response_data:
        return []
    
    attributes = response_data.get('data', {}).get('attributes', {})
    dates = attributes.get('dates', [])
    data = attributes.get('data', [])
    
    results = []
    
    if data and len(data) > 0:
        measurements = data[0].get('measurements', {})
        counts = measurements.get('count', [])
        
        for i, date_str in enumerate(dates):
            if i < len(counts):
                results.append({
                    'metric_name': metric_name,
                    'timestamp': date_str,
                    'count': int(counts[i])
                })
    
    return results

def main():
    """Main execution"""
    print("=" * 60)
    print("Klaviyo Event Fetcher")
    print("=" * 60)
    
    # Check API key
    if not KLAVIYO_API_KEY:
        print("\n❌ Error: KLAVIYO_API_KEY not found in environment variables")
        print("Please create a .env file with your Klaviyo API key:")
        print("  KLAVIYO_API_KEY=your_private_api_key_here")
        return
    
    # Step 1: Fetch all metrics
    print("\n1. Fetching all metrics...")
    metrics = get_all_metrics()
    print(f"✓ Found {len(metrics)} total metrics\n")
    
    # Display metrics
    print("Available metrics:")
    for metric in metrics[:10]:  # Show first 10
        metric_id = metric.get('id')
        metric_name = metric.get('attributes', {}).get('name')
        print(f"  - {metric_name} (ID: {metric_id})")
    
    if len(metrics) > 10:
        print(f"  ... and {len(metrics) - 10} more")
    
    # Step 2: Query aggregates for each metric (last 1 hour - like the worker)
    print(f"\n2. Querying event counts for LAST 1 HOUR (as worker does)...")
    print(f"   Rate limit: {RATE_LIMIT_DELAY}s delay between requests (60 requests/min)")
    all_event_data = []
    hours_returned_counts = []  # Track how many hours Klaviyo returns
    
    for i, metric in enumerate(metrics):
        metric_id = metric.get('id')
        metric_name = metric.get('attributes', {}).get('name')
        
        print(f"  [{i+1}/{len(metrics)}] Querying: {metric_name}...", end=' ')
        
        # Rate limiting: wait between requests
        if i > 0:  # Don't wait before first request
            time.sleep(RATE_LIMIT_DELAY)
        
        aggregate_data = query_metric_aggregates(metric_id, metric_name)
        
        if aggregate_data:
            events = process_aggregate_response(aggregate_data, metric_name)
            all_event_data.extend(events)
            hours_returned_counts.append(len(events))
            
            total_count = sum(e['count'] for e in events)
            hours_info = f"({len(events)} hours)" if len(events) != 1 else "(1 hour)"
            print(f"✓ {total_count} events {hours_info}")
        else:
            print("✗ Failed")
    
    # Step 3: Display results
    print(f"\n3. Results Summary")
    print("=" * 60)
    print(f"Total event records: {len(all_event_data)}")
    
    # Analyze how many hours Klaviyo returned
    if hours_returned_counts:
        avg_hours = sum(hours_returned_counts) / len(hours_returned_counts)
        max_hours = max(hours_returned_counts)
        min_hours = min(hours_returned_counts)
        print(f"\n⚠️  HOURS RETURNED BY KLAVIYO:")
        print(f"   Min: {min_hours}, Max: {max_hours}, Avg: {avg_hours:.1f}")
        if max_hours > 1:
            print(f"   ❌ Klaviyo returned MORE than 1 hour for some metrics!")
            print(f"   This explains why you see 2x the expected records.")
    
    # Group by metric and sum counts
    metric_totals = {}
    for event in all_event_data:
        metric_name = event['metric_name']
        count = event['count']
        metric_totals[metric_name] = metric_totals.get(metric_name, 0) + count
    
    print("\nEvent counts by metric:")
    for metric_name, total in sorted(metric_totals.items(), key=lambda x: x[1], reverse=True):
        if total > 0:
            print(f"  {metric_name}: {total}")
    
    # Save to file
    output_file = 'klaviyo_events.json'
    with open(output_file, 'w') as f:
        json.dump(all_event_data, f, indent=2)
    
    print(f"\n✓ Data saved to {output_file}")

if __name__ == '__main__':
    main()
