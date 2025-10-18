"""
Klaviyo Event Worker - Cloud Function
Fetches hourly event counts from Klaviyo and stores in database
"""

import functions_framework
import requests
import json
import os
import base64
from datetime import datetime, timedelta, timezone
import psycopg2
from psycopg2.extras import execute_batch
import time

# Configuration
KLAVIYO_API_BASE = 'https://a.klaviyo.com/api'
REVISION = '2025-10-15'
RATE_LIMIT_DELAY = 1.0  # 1 second between requests

# --- Structured Logging ---
def log(level, message, **kwargs):
    entry = {"severity": level.upper(), "function": "klaviyo-event-worker", "message": message}
    if kwargs:
        entry.update(kwargs)
    print(json.dumps(entry))

# --- Klaviyo API Functions ---
def get_headers(api_key):
    """Get headers for Klaviyo API requests"""
    return {
        'Authorization': f'Klaviyo-API-Key {api_key}',
        'revision': REVISION,
        'Content-Type': 'application/json'
    }

def get_all_metrics(api_key):
    """Fetch all metrics from Klaviyo with pagination"""
    url = f'{KLAVIYO_API_BASE}/metrics'
    headers = get_headers(api_key)
    
    all_metrics = []
    next_cursor = None
    
    while True:
        params = {}
        if next_cursor:
            params['page[cursor]'] = next_cursor
        
        response = requests.get(url, headers=headers, params=params)
        
        if response.status_code != 200:
            log("error", "Failed to fetch metrics", status=response.status_code, response=response.text)
            break
        
        data = response.json()
        metrics = data.get('data', [])
        all_metrics.extend(metrics)
        
        # Check for next page
        links = data.get('links', {})
        if 'next' in links and links['next']:
            next_url = links['next']
            if 'page[cursor]=' in next_url:
                next_cursor = next_url.split('page[cursor]=')[-1].split('&')[0]
            else:
                break
        else:
            break
    
    return all_metrics

def query_metric_aggregates(api_key, metric_id, start_time, end_time):
    """Query hourly aggregates for a specific metric"""
    url = f'{KLAVIYO_API_BASE}/metric-aggregates'
    headers = get_headers(api_key)
    
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
    
    response = requests.post(url, headers=headers, json=payload)
    
    if response.status_code != 200:
        log("warning", "Failed to query metric aggregate", 
            metric_id=metric_id, status=response.status_code)
        return None
    
    return response.json()

def process_aggregate_response(response_data, metric_name):
    """Extract hourly counts from aggregate response"""
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

# --- Database Functions ---
def get_db_connection(db_uri):
    """Connect to database"""
    return psycopg2.connect(db_uri)

def get_client_id(conn, brand_name):
    """Get client_id for Klaviyo integration"""
    query = """
        SELECT id FROM clients 
        WHERE brand_name = %s 
          AND integration_name = 'klaviyo'
          AND is_active = true
        LIMIT 1;
    """
    with conn.cursor() as cur:
        cur.execute(query, (brand_name,))
        result = cur.fetchone()
        return result[0] if result else None

def insert_event_data(conn, client_id, brand_name, events):
    """Batch insert event data"""
    if not events:
        return 0
    
    query = """
        INSERT INTO event_data (client_id, brand, integration_name, event_name, timestamp, count)
        VALUES (%s, %s, %s, %s, %s, %s)
        ON CONFLICT DO NOTHING;
    """
    
    values = [
        (client_id, brand_name, 'klaviyo', event['metric_name'], 
         event['timestamp'], event['count'])
        for event in events
    ]
    
    with conn.cursor() as cur:
        execute_batch(cur, query, values)
        conn.commit()
    
    return len(values)

# --- Main Cloud Function ---
@functions_framework.cloud_event
def klaviyo_event_worker(cloud_event):
    """
    Cloud Function triggered by Pub/Sub to fetch Klaviyo events
    
    Expected message format:
    {
        "brand_name": "YourBrand",
        "klaviyo_api_key": "pk_xxx",
        "hours_back": 2
    }
    """
    # Decode Pub/Sub message
    try:
        pubsub_message = base64.b64decode(cloud_event.data["message"]["data"]).decode()
        job_data = json.loads(pubsub_message)
        brand_name = job_data["brand_name"]
        klaviyo_api_key = job_data["klaviyo_api_key"]
        hours_back = job_data.get("hours_back", 2)
        
        log("info", "Received job", brand=brand_name, hours_back=hours_back)
    except Exception as e:
        log("error", "Failed to decode message", error=str(e))
        return ("Bad Request", 400)
    
    conn = None
    try:
        # Connect to database
        db_uri = os.environ.get("SUPABASE_CONNECTION_URI")
        if not db_uri:
            raise ValueError("SUPABASE_CONNECTION_URI not found")
        
        conn = get_db_connection(db_uri)
        log("info", "Connected to database", brand=brand_name)
        
        # Get client_id
        client_id = get_client_id(conn, brand_name)
        if not client_id:
            log("error", "Client not found", brand=brand_name)
            return ("Client not found", 404)
        
        # Calculate time range
        end_time = datetime.now(timezone.utc)
        start_time = end_time - timedelta(hours=hours_back)
        
        log("info", "Fetching metrics", brand=brand_name, 
            start=start_time.isoformat(), end=end_time.isoformat())
        
        # Fetch all metrics
        metrics = get_all_metrics(klaviyo_api_key)
        log("info", "Fetched metrics", brand=brand_name, count=len(metrics))
        
        # Query aggregates for each metric
        all_events = []
        processed = 0
        failed = 0
        
        for i, metric in enumerate(metrics):
            metric_id = metric.get('id')
            metric_name = metric.get('attributes', {}).get('name')
            
            # Rate limiting
            if i > 0:
                time.sleep(RATE_LIMIT_DELAY)
            
            aggregate_data = query_metric_aggregates(
                klaviyo_api_key, metric_id, start_time, end_time
            )
            
            if aggregate_data:
                events = process_aggregate_response(aggregate_data, metric_name)
                all_events.extend(events)
                processed += 1
            else:
                failed += 1
        
        # Insert into database
        inserted = insert_event_data(conn, client_id, brand_name, all_events)
        
        log("info", "Job complete", 
            brand=brand_name,
            metrics_processed=processed,
            metrics_failed=failed,
            events_inserted=inserted)
        
        return ("OK", 200)
        
    except Exception as e:
        log("error", "Fatal error", brand=brand_name, error=str(e))
        raise
    finally:
        if conn:
            conn.close()
            log("info", "Database connection closed", brand=brand_name)
