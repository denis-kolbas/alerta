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
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from google.cloud import pubsub_v1

# Configuration
KLAVIYO_API_BASE = 'https://a.klaviyo.com/api'
REVISION = '2025-10-15'
RATE_LIMIT_DELAY = 1.0  # 1 second between requests
REQUEST_TIMEOUT = (10, 30)  # (connect timeout, read timeout)
MAX_METRICS_TO_PROCESS = 200  # Safety limit
HOURS_BACK = 1  # Fetch events from last hour
PROJECT_ID = "gen-lang-client-0044777751"
ALERT_ANALYSIS_TOPIC = "alert-analysis-queue"

# --- Structured Logging ---
def log(level, message, **kwargs):
    entry = {"severity": level.upper(), "function": "klaviyo-event-worker", "message": message}
    if kwargs:
        entry.update(kwargs)
    print(json.dumps(entry))

# --- HTTP Session ---
def get_session_with_retries():
    """Create HTTP session with retry logic"""
    session = requests.Session()
    retry_strategy = Retry(
        total=3,
        backoff_factor=1,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["GET", "POST"]
    )
    adapter = HTTPAdapter(max_retries=retry_strategy)
    session.mount("https://", adapter)
    return session

# --- Klaviyo API Functions ---
def get_headers(api_key):
    """Get headers for Klaviyo API requests"""
    return {
        'Authorization': f'Klaviyo-API-Key {api_key}',
        'revision': REVISION,
        'Content-Type': 'application/json'
    }

def get_all_metrics(session, api_key):
    """Fetch all metrics from Klaviyo with pagination"""
    url = f'{KLAVIYO_API_BASE}/metrics'
    headers = get_headers(api_key)
    
    all_metrics = []
    next_cursor = None
    max_pages = 100  # Safety limit to prevent infinite loops
    page_count = 0
    
    while page_count < max_pages:
        page_count += 1
        params = {}
        if next_cursor:
            params['page[cursor]'] = next_cursor
        
        try:
            response = session.get(url, headers=headers, params=params, timeout=REQUEST_TIMEOUT)
            response.raise_for_status()
        except requests.exceptions.RequestException as e:
            log("error", "Failed to fetch metrics", page=page_count, error=str(e))
            break
        
        data = response.json()
        metrics = data.get('data', [])
        
        # If no metrics returned, we're done
        if not metrics:
            break
            
        all_metrics.extend(metrics)
        log("info", f"Fetched page {page_count}", metrics_count=len(metrics), total=len(all_metrics))
        
        # Check for next page
        links = data.get('links', {})
        if 'next' in links and links['next']:
            next_url = links['next']
            if 'page[cursor]=' in next_url:
                new_cursor = next_url.split('page[cursor]=')[-1].split('&')[0]
                # Prevent infinite loop if cursor doesn't change
                if new_cursor == next_cursor:
                    log("warning", "Pagination cursor not changing, stopping")
                    break
                next_cursor = new_cursor
            else:
                break
        else:
            break
    
    if page_count >= max_pages:
        log("warning", "Hit max page limit", max_pages=max_pages, metrics_fetched=len(all_metrics))
    
    return all_metrics

def query_metric_aggregates(session, api_key, metric_id, start_time, end_time, log_first=False):
    """Query hourly aggregates for a specific metric"""
    url = f'{KLAVIYO_API_BASE}/metric-aggregates'
    headers = get_headers(api_key)
    
    start_str = start_time.strftime('%Y-%m-%dT%H:%M:%S')
    end_str = end_time.strftime('%Y-%m-%dT%H:%M:%S')
    
    # Log the first query to debug
    if log_first:
        log("info", "First metric query details",
            start_time=start_str,
            end_time=end_str,
            metric_id=metric_id)
    
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
    
    try:
        response = session.post(url, headers=headers, json=payload, timeout=REQUEST_TIMEOUT)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        log("warning", "Failed to query metric aggregate", 
            metric_id=metric_id, error=str(e))
        return None

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
        
        # Log if Klaviyo returns more than 1 hour
        if len(dates) > 1:
            log("warning", "Klaviyo returned multiple hours", 
                metric=metric_name, 
                hours_returned=len(dates),
                dates=dates)
        
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
    """Connect to database with timeout"""
    return psycopg2.connect(db_uri, connect_timeout=10)

def insert_event_data(conn, client_id, brand_name, events):
    """Batch insert event data with chunking to avoid long transactions"""
    if not events:
        return 0
    
    query = """
        INSERT INTO event_data (client_id, brand, integration_name, event_name, timestamp, count)
        VALUES (%s, %s, %s, %s, %s, %s)
        ON CONFLICT (client_id, event_name, timestamp) DO NOTHING;
    """
    
    values = [
        (client_id, brand_name, 'klaviyo', event['metric_name'], 
         event['timestamp'], event['count'])
        for event in events
    ]
    
    # Insert in chunks of 100 to avoid long transactions
    chunk_size = 100
    total_inserted = 0
    
    try:
        with conn.cursor() as cur:
            for i in range(0, len(values), chunk_size):
                chunk = values[i:i + chunk_size]
                execute_batch(cur, query, chunk)
                conn.commit()
                total_inserted += len(chunk)
                
                if (i + chunk_size) % 500 == 0:
                    log("info", "Insert progress", inserted=total_inserted, total=len(values))
    except Exception as e:
        conn.rollback()
        log("error", "Insert failed", error=str(e), inserted_so_far=total_inserted)
        raise
    
    return total_inserted

# --- Main Cloud Function ---
def klaviyo_event_worker(request):
    """
    Cloud Function triggered by Pub/Sub to fetch Klaviyo events
    
    Expected message format (from dispatcher):
    {
        "client_id": 123,
        "brand_name": "YourBrand",
        "integration_type": "klaviyo",
        "instance_url": "...",  (not used for Klaviyo)
        "api_key": "pk_xxx"
    }
    """
    # Validate Pub/Sub message format
    envelope = request.get_json(silent=True)
    if not envelope or "message" not in envelope:
        log("warning", "Invalid request")
        return ("OK", 200)
    
    # Decode Pub/Sub message
    try:
        pubsub_message = envelope["message"]
        job_data = json.loads(base64.b64decode(pubsub_message["data"]).decode("utf-8"))
        client_id = job_data["client_id"]
        brand_name = job_data["brand_name"]
        api_key = job_data["api_key"]  # Changed from "klaviyo_api_key"
        
        log("info", "Received job", client_id=client_id, brand=brand_name, hours_back=HOURS_BACK)
    except Exception as e:
        log("error", "Failed to decode message", error=str(e))
        # Don't retry on bad message format
        return ("Bad Request", 200)
    
    session = get_session_with_retries()
    conn = None
    try:
        # Connect to database
        db_uri = os.environ.get("SUPABASE_CONNECTION_URI")
        if not db_uri:
            raise ValueError("SUPABASE_CONNECTION_URI not found")
        
        conn = get_db_connection(db_uri)
        log("info", "Connected to database", client_id=client_id, brand=brand_name)
        
        # Calculate time range - align to hour boundaries
        # Get the most recent completed hour
        current_time = datetime.now(timezone.utc)
        end_time = current_time.replace(minute=0, second=0, microsecond=0)
        start_time = end_time - timedelta(hours=HOURS_BACK)
        
        log("info", "Fetching metrics", 
            client_id=client_id, 
            brand=brand_name,
            current_time=current_time.isoformat(),
            start=start_time.isoformat(), 
            end=end_time.isoformat(),
            hours_back=HOURS_BACK)
        
        # Fetch all metrics
        metrics = get_all_metrics(session, api_key)
        log("info", "Fetched metrics", client_id=client_id, brand=brand_name, count=len(metrics))
        
        # Limit metrics to process (safety measure)
        if len(metrics) > MAX_METRICS_TO_PROCESS:
            log("warning", "Too many metrics, limiting", 
                client_id=client_id,
                brand=brand_name, 
                total=len(metrics), 
                processing=MAX_METRICS_TO_PROCESS)
            metrics = metrics[:MAX_METRICS_TO_PROCESS]
        
        # Query aggregates for each metric
        all_events = []
        processed = 0
        failed = 0
        
        log("info", "Processing metrics", client_id=client_id, brand=brand_name, total_metrics=len(metrics))
        
        for i, metric in enumerate(metrics):
            metric_id = metric.get('id')
            metric_name = metric.get('attributes', {}).get('name')
            
            # Rate limiting
            if i > 0:
                time.sleep(RATE_LIMIT_DELAY)
            
            # Log progress every 10 metrics
            if (i + 1) % 10 == 0:
                log("info", "Progress update", 
                    client_id=client_id,
                    brand=brand_name, 
                    processed=i+1, 
                    total=len(metrics),
                    events_collected=len(all_events))
            
            aggregate_data = query_metric_aggregates(
                session, api_key, metric_id, start_time, end_time, log_first=(i == 0)
            )
            
            if aggregate_data:
                events = process_aggregate_response(aggregate_data, metric_name)
                all_events.extend(events)
                processed += 1
            else:
                failed += 1
        
        # Insert into database
        try:
            inserted = insert_event_data(conn, client_id, brand_name, all_events)
            log("info", "Job complete", 
                client_id=client_id,
                brand=brand_name,
                metrics_processed=processed,
                metrics_failed=failed,
                events_inserted=inserted)
            
            # Publish to alert-analysis-queue for anomaly detection
            if inserted > 0:
                try:
                    publisher = pubsub_v1.PublisherClient()
                    topic_path = publisher.topic_path(PROJECT_ID, ALERT_ANALYSIS_TOPIC)
                    
                    # Get unique event names from all_events
                    unique_events = list(set(event['metric_name'] for event in all_events))
                    
                    analysis_message = {
                        "brand_name": brand_name,
                        "integration_name": "klaviyo",
                        "client_id": client_id,
                        "events_processed": unique_events,
                        "timestamp": end_time.isoformat()
                    }
                    
                    message_data = json.dumps(analysis_message).encode("utf-8")
                    future = publisher.publish(topic_path, message_data)
                    future.result()  # Wait for publish to complete
                    
                    log("info", "Published to alert-analysis-queue", 
                        client_id=client_id,
                        brand=brand_name, 
                        events_count=len(unique_events))
                except Exception as pub_error:
                    log("error", "Failed to publish to Pub/Sub", 
                        client_id=client_id,
                        brand=brand_name, 
                        error=str(pub_error))
                    # Don't fail the whole function if Pub/Sub fails
            
        except psycopg2.OperationalError as e:
            log("error", "Database connection error during insert", 
                client_id=client_id,
                brand=brand_name, 
                error=str(e),
                events_collected=len(all_events))
            # Try to reconnect and insert again
            try:
                if conn:
                    conn.close()
                conn = get_db_connection(db_uri)
                log("info", "Reconnected to database", client_id=client_id, brand=brand_name)
                inserted = insert_event_data(conn, client_id, brand_name, all_events)
                log("info", "Job complete after reconnect", 
                    client_id=client_id,
                    brand=brand_name,
                    events_inserted=inserted)
            except Exception as retry_error:
                log("error", "Failed to insert after reconnect", 
                    client_id=client_id,
                    brand=brand_name, 
                    error=str(retry_error))
                # Don't raise - acknowledge the message to prevent infinite retries
                return ("OK", 200)
        
        log("info", "Function completed successfully", client_id=client_id, brand=brand_name)
        return ("OK", 200)
        
    except psycopg2.OperationalError as e:
        log("error", "Database connection error", client_id=client_id if 'client_id' in locals() else None, brand=brand_name if 'brand_name' in locals() else None, error=str(e))
        # Don't raise - acknowledge to prevent infinite retries
        return ("OK", 200)
    except Exception as e:
        log("error", "Fatal error", client_id=client_id if 'client_id' in locals() else None, brand=brand_name if 'brand_name' in locals() else None, error=str(e))
        # Don't raise - acknowledge to prevent infinite retries
        return ("OK", 200)
    finally:
        if conn:
            try:
                conn.close()
                log("info", "Database connection closed", client_id=client_id if 'client_id' in locals() else None, brand=brand_name if 'brand_name' in locals() else None)
            except Exception as e:
                log("warning", "Error closing database connection", error=str(e))
        try:
            session.close()
        except Exception as e:
            log("warning", "Error closing HTTP session", error=str(e))