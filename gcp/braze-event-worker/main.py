import base64
import json
import os
import logging
from datetime import datetime, timezone
import psycopg2
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from google.cloud import pubsub_v1

# --- Config ---
REQUEST_TIMEOUT = (5, 20)
PROJECT_ID = "gen-lang-client-0044777751"
ALERT_ANALYSIS_TOPIC = "alert-analysis-queue"

# --- Structured Logging ---
def log(level, message, **kwargs):
    entry = {"severity": level.upper(), "function": "braze-event-worker", "message": message}
    if kwargs:
        entry.update(kwargs)
    print(json.dumps(entry))

def summarize_list(items, limit=5):
    """Returns a readable summary of long lists."""
    if len(items) <= limit:
        return items
    return items[:limit] + [f"...(+{len(items)-limit} more)"]

# --- HTTP Session ---
def get_session_with_retries():
    session = requests.Session()
    retry_strategy = Retry(
        total=3,
        backoff_factor=1,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["GET"]
    )
    adapter = HTTPAdapter(max_retries=retry_strategy)
    session.mount("https://", adapter)
    return session

# --- Braze API ---
def get_events(session, instance_url, api_key):
    url = f"https://{instance_url}/events/list"
    headers = {"Authorization": f"Bearer {api_key}"}
    response = session.get(url, headers=headers, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    return response.json().get("events", [])

def get_event_data_series(session, instance_url, api_key, event_name, ending_at):
    url = f"https://{instance_url}/events/data_series"
    params = {
        "event": event_name,
        "length": 1,
        "unit": "hour",
        "ending_at": ending_at.isoformat().replace("+00:00", "Z")
    }
    headers = {"Authorization": f"Bearer {api_key}"}
    response = session.get(url, headers=headers, params=params, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    return response.json().get("data", [])

# --- Database ---
def get_db_connection(db_uri):
    return psycopg2.connect(db_uri)

def insert_event_data(conn, client_id, brand_name, event_name, data, query_timestamp):
    insert_query = """
        INSERT INTO event_data (client_id, brand, integration_name, event_name, timestamp, count)
        VALUES (%s, %s, %s, %s, %s, %s)
        ON CONFLICT (client_id, event_name, timestamp) DO NOTHING;
    """
    try:
        with conn.cursor() as cur:
            if data:
                for d in data:
                    ts = datetime.fromisoformat(d["time"].replace("Z", "+00:00"))
                    cur.execute(insert_query, (client_id, brand_name, 'braze', event_name, ts, d["count"]))
            else:
                cur.execute(insert_query, (client_id, brand_name, 'braze', event_name, query_timestamp, 0))
        conn.commit()
    except Exception as e:
        conn.rollback()
        log("error", "DB insert failed", brand=brand_name, event=event_name, error=str(e))
        raise

# --- Main ---
def braze_event_worker(request):
    envelope = request.get_json(silent=True)
    if not envelope or "message" not in envelope:
        log("warning", "Invalid request")
        return ("OK", 200)

    try:
        pubsub_message = envelope["message"]
        client_config = json.loads(base64.b64decode(pubsub_message["data"]).decode("utf-8"))
        client_id = client_config["client_id"]
        brand_name = client_config["brand_name"]
        instance_url = client_config["instance_url"]
        api_key = client_config["api_key"]
        log("info", "Received job", client_id=client_id, brand=brand_name, instance_url=instance_url)
    except Exception as e:
        log("error", "Failed to decode Pub/Sub message", error=str(e))
        return ("Bad Request", 200)

    session = get_session_with_retries()
    conn = None
    try:
        db_uri = os.environ.get("SUPABASE_CONNECTION_URI")
        if not db_uri:
            raise ValueError("SUPABASE_CONNECTION_URI not found")

        conn = get_db_connection(db_uri)
        log("info", "Connected to database", client_id=client_id, brand=brand_name)

        events = get_events(session, instance_url, api_key)
        log("info", "Fetched event list",
            client_id=client_id,
            brand=brand_name,
            event_count=len(events),
            events=summarize_list(events))

        ending_at = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
        failed = []

        for event_name in events:
            try:
                data = get_event_data_series(session, instance_url, api_key, event_name, ending_at)
                insert_event_data(conn, client_id, brand_name, event_name, data, ending_at)
            except Exception as e:
                failed.append(event_name)
                log("error", "Event processing failed", client_id=client_id, brand=brand_name, event=event_name, error=str(e))

        if failed:
            log("warning", "Partial failure", client_id=client_id, brand=brand_name, failed_events=summarize_list(failed))
            return (f"Partial failure for {brand_name}", 200)

        log("info", "Successfully processed all events", client_id=client_id, brand=brand_name, total_events=len(events))
        
        # Publish to event analyzer for anomaly detection
        try:
            publisher = pubsub_v1.PublisherClient()
            topic_path = publisher.topic_path(PROJECT_ID, ALERT_ANALYSIS_TOPIC)
            
            analysis_message = {
                "brand_name": brand_name,
                "integration_name": "braze",
                "client_id": client_id,
                "events_processed": events,
                "timestamp": ending_at.isoformat()
            }
            
            future = publisher.publish(topic_path, data=json.dumps(analysis_message).encode("utf-8"))
            future.result(timeout=10)
            
            log("info", "Published to event analyzer", 
                client_id=client_id,
                brand=brand_name, 
                event_count=len(events))
        except Exception as e:
            log("error", "Failed to publish to event analyzer", 
                client_id=client_id,
                brand=brand_name, 
                error=str(e))
            # Don't fail the whole job if alert publishing fails
            
    except Exception as e:
        log("error", "Fatal error in worker", client_id=client_id if 'client_id' in locals() else None, brand=brand_name if 'brand_name' in locals() else None, error=str(e))
        raise
    finally:
        if conn:
            conn.close()
            log("info", "Database connection closed", client_id=client_id if 'client_id' in locals() else None, brand=brand_name if 'brand_name' in locals() else None)
        session.close()

    return ("OK", 200)
