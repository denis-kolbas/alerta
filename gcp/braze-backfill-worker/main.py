import base64
import json
import os
import logging
import time
from datetime import datetime, timezone, timedelta
import psycopg2
import psycopg2.extras
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# --- Config ---
REQUEST_TIMEOUT = (5, 30)
MAX_BACKFILL_DAYS = 30
CHUNK_SIZE_HOURS = 100
DB_CONNECT_TIMEOUT = 10
FUNCTION_TIMEOUT_SEC = int(os.environ.get('FUNCTION_TIMEOUT_SEC', 540))
SAFETY_MARGIN_SEC = 30

# --- Structured Logging ---
def log(level, message, **kwargs):
    entry = {"severity": level.upper(), "function": "braze-backfill-worker", "message": message}
    if kwargs:
        entry.update(kwargs)
    print(json.dumps(entry))

# --- HTTP Session ---
def get_session_with_retries():
    session = requests.Session()
    retry_strategy = Retry(
        total=3,
        backoff_factor=2,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["GET"]
    )
    adapter = HTTPAdapter(max_retries=retry_strategy)
    session.mount("https://", adapter)
    return session

# --- Braze API ---
class PermanentAPIError(Exception):
    """Raised when API returns a permanent error that shouldn't be retried."""
    pass

def get_event_data_series_chunk(session, instance_url, api_key, event_name, ending_at, length_hours):
    """Fetch a chunk of historical data for an event."""
    url = f"https://{instance_url}/events/data_series"
    params = {
        "event": event_name,
        "length": length_hours,
        "unit": "hour",
        "ending_at": ending_at.isoformat().replace("+00:00", "Z")
    }
    headers = {"Authorization": f"Bearer {api_key}"}
    try:
        response = session.get(url, headers=headers, params=params, timeout=REQUEST_TIMEOUT)
        response.raise_for_status()
        return response.json().get("data", [])
    except requests.exceptions.HTTPError as e:
        # Permanent failures - don't retry
        if e.response is not None and e.response.status_code in [400, 401, 403, 404]:
            log("error", "Permanent API error - invalid config or event",
                event=event_name,
                status_code=e.response.status_code,
                error=str(e))
            raise PermanentAPIError(f"Permanent API failure: {e.response.status_code}")
        # Transient failures - will retry
        log("error", "Transient API error",
            event=event_name,
            error=str(e))
        raise
    except requests.exceptions.RequestException as e:
        log("error", "Network error fetching event data",
            event=event_name,
            ending_at=ending_at.isoformat(),
            length=length_hours,
            error=str(e))
        raise

# --- Database ---
def get_db_connection(db_uri):
    """Get a database connection with proper timeout settings."""
    return psycopg2.connect(
        db_uri,
        connect_timeout=DB_CONNECT_TIMEOUT,
        options='-c statement_timeout=30000'
    )

def insert_event_data_batch(conn, client_id, brand_name, event_name, data_points):
    """
    Insert multiple data points using execute_values for best performance.
    Reuses the provided connection.
    """
    if not data_points:
        return
    
    insert_query = """
        INSERT INTO event_data (client_id, brand, integration_name, event_name, timestamp, count)
        VALUES %s
        ON CONFLICT (client_id, event_name, timestamp) DO NOTHING;
    """
    
    # Prepare data for execute_values
    data_tuples = []
    for d in data_points:
        ts = datetime.fromisoformat(d["time"].replace("Z", "+00:00"))
        data_tuples.append((client_id, brand_name, 'braze', event_name, ts, d["count"]))
    
    try:
        with conn.cursor() as cur:
            # execute_values is faster than execute_batch (single SQL statement)
            psycopg2.extras.execute_values(
                cur, 
                insert_query, 
                data_tuples,
                page_size=len(data_tuples)
            )
        conn.commit()
        
    except Exception as e:
        if conn and not conn.closed:
            try:
                conn.rollback()
            except Exception as rollback_error:
                log("debug", "Failed to rollback", error=str(rollback_error))
        log("error", "DB batch insert failed",
            brand=brand_name,
            event=event_name,
            data_points=len(data_points),
            error=str(e))
        raise

def calculate_backfill_days(conn, client_id, event_name):
    """
    Calculate how many days to backfill based on most recent data.
    Reuses the provided connection.
    """
    query = """
        SELECT MAX(timestamp) as latest_timestamp
        FROM event_data
        WHERE client_id = %s AND event_name = %s;
    """
    try:
        with conn.cursor() as cur:
            cur.execute(query, (client_id, event_name))
            result = cur.fetchone()
            
            if result and result[0]:
                latest_timestamp = result[0]
                now = datetime.now(timezone.utc)
                
                if latest_timestamp.tzinfo is None:
                    latest_timestamp = latest_timestamp.replace(tzinfo=timezone.utc)
                
                days_gap = (now - latest_timestamp).days
                backfill_days = min(days_gap + 1, MAX_BACKFILL_DAYS)
                
                log("info", "Calculated backfill period",
                    client_id=client_id,
                    event=event_name,
                    latest_data=latest_timestamp.isoformat(),
                    days_gap=days_gap,
                    backfill_days=backfill_days)
                return backfill_days
            else:
                log("info", "No existing data, backfilling full period",
                    client_id=client_id,
                    event=event_name,
                    backfill_days=MAX_BACKFILL_DAYS)
                return MAX_BACKFILL_DAYS
                
    except Exception as e:
        log("warning", "Failed to calculate backfill period, using default",
            client_id=client_id,
            event=event_name,
            error=str(e),
            default_days=MAX_BACKFILL_DAYS)
        return MAX_BACKFILL_DAYS

def backfill_event_history(session, conn, client_id, brand_name, instance_url, api_key, event_name, start_time):
    """
    Backfill historical data for a single event by making chunked API calls.
    Reuses the provided HTTP session and DB connection.
    """
    backfill_days = calculate_backfill_days(conn, client_id, event_name)
    total_hours = backfill_days * 24
    chunks_needed = (total_hours + CHUNK_SIZE_HOURS - 1) // CHUNK_SIZE_HOURS
    
    max_runtime = FUNCTION_TIMEOUT_SEC - SAFETY_MARGIN_SEC
    
    log("info", "Starting backfill for event",
        client_id=client_id,
        brand=brand_name,
        event=event_name,
        total_hours=total_hours,
        chunks_needed=chunks_needed,
        backfill_days=backfill_days,
        max_runtime_sec=max_runtime)
    
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    total_data_points = 0
    chunks_completed = 0
    
    for chunk_idx in range(chunks_needed):
        # Check if we're approaching timeout
        elapsed = time.time() - start_time
        if elapsed > max_runtime:
            log("warning", "Approaching function timeout, stopping early",
                client_id=client_id,
                brand=brand_name,
                event=event_name,
                chunks_completed=chunks_completed,
                chunks_remaining=chunks_needed - chunks_completed,
                elapsed_sec=int(elapsed),
                message="Next Pub/Sub retry will continue from where we left off")
            break
        
        hours_back = chunk_idx * CHUNK_SIZE_HOURS
        ending_at = now - timedelta(hours=hours_back)
        remaining_hours = total_hours - hours_back
        chunk_length = min(CHUNK_SIZE_HOURS, remaining_hours)
        chunk_start = ending_at - timedelta(hours=chunk_length)
        
        try:
            log("info", "Fetching chunk",
                client_id=client_id,
                brand=brand_name,
                event=event_name,
                chunk=f"{chunk_idx + 1}/{chunks_needed}",
                date_range=f"{chunk_start.strftime('%Y-%m-%d %H:%M')} to {ending_at.strftime('%Y-%m-%d %H:%M')}",
                hours=chunk_length,
                elapsed_sec=int(elapsed))
            
            data = get_event_data_series_chunk(session, instance_url, api_key, event_name, ending_at, chunk_length)
            
            if data:
                insert_event_data_batch(conn, client_id, brand_name, event_name, data)
                total_data_points += len(data)
                chunks_completed += 1
                log("info", "Inserted chunk with data",
                    client_id=client_id,
                    brand=brand_name,
                    event=event_name,
                    chunk=f"{chunk_idx + 1}/{chunks_needed}",
                    data_points=len(data),
                    total_so_far=total_data_points)
            else:
                # API returned 200 with empty data = actual zeros
                zero_data = []
                for hour_offset in range(chunk_length):
                    ts = ending_at - timedelta(hours=hour_offset)
                    zero_data.append({
                        "time": ts.isoformat().replace("+00:00", "Z"),
                        "count": 0
                    })
                insert_event_data_batch(conn, client_id, brand_name, event_name, zero_data)
                total_data_points += len(zero_data)
                chunks_completed += 1
                log("info", "No events in chunk, inserted zeros",
                    client_id=client_id,
                    brand=brand_name,
                    event=event_name,
                    chunk=f"{chunk_idx + 1}/{chunks_needed}",
                    zero_count=len(zero_data))
                    
        except PermanentAPIError:
            raise
        except Exception as e:
            log("error", "Failed to process chunk",
                client_id=client_id,
                brand=brand_name,
                event=event_name,
                chunk=f"{chunk_idx + 1}/{chunks_needed}",
                error=str(e))
            raise
    
    log("info", "Completed backfill for event",
        client_id=client_id,
        brand=brand_name,
        event=event_name,
        total_data_points=total_data_points,
        chunks_processed=chunks_completed,
        chunks_total=chunks_needed,
        complete=chunks_completed == chunks_needed)
    
    return total_data_points, chunks_completed == chunks_needed

# --- Main ---
def braze_backfill_worker(request):
    start_time = time.time()
    
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
        event_name = client_config.get("event_name")
        
        if not event_name:
            log("error", "No event_name in message, skipping")
            return ("OK", 200)
        
        log("info", "Received backfill job for single event",
            client_id=client_id,
            brand=brand_name,
            event=event_name,
            instance_url=instance_url,
            max_backfill_days=MAX_BACKFILL_DAYS)
            
    except Exception as e:
        log("error", "Failed to decode Pub/Sub message", error=str(e))
        return ("OK", 200)
    
    session = get_session_with_retries()
    conn = None
    
    try:
        db_uri = os.environ.get("SUPABASE_CONNECTION_URI")
        if not db_uri:
            raise ValueError("SUPABASE_CONNECTION_URI not found")
        
        # Single connection for entire execution
        conn = get_db_connection(db_uri)
        
        try:
            data_points, complete = backfill_event_history(
                session, conn, client_id, brand_name,
                instance_url, api_key, event_name, start_time
            )
            
            if complete:
                log("info", "Event backfill completed successfully",
                    client_id=client_id,
                    brand=brand_name,
                    event=event_name,
                    data_points=data_points,
                    duration_sec=int(time.time() - start_time))
            else:
                log("info", "Event backfill partially completed (timeout protection)",
                    client_id=client_id,
                    brand=brand_name,
                    event=event_name,
                    data_points=data_points,
                    duration_sec=int(time.time() - start_time),
                    message="Pub/Sub will retry to complete remaining chunks")
                
        except PermanentAPIError as e:
            log("error", "Permanent API failure - not retrying",
                client_id=client_id,
                brand=brand_name,
                event=event_name,
                error=str(e))
            return ("OK", 200)
            
        except Exception as e:
            log("error", "Event backfill failed with transient error",
                client_id=client_id,
                brand=brand_name,
                event=event_name,
                error=str(e),
                duration_sec=int(time.time() - start_time))
            raise
            
    except Exception as e:
        log("error", "Fatal error in backfill worker",
            client_id=client_id if 'client_id' in locals() else None,
            brand=brand_name if 'brand_name' in locals() else None,
            error=str(e),
            duration_sec=int(time.time() - start_time))
        raise
        
    finally:
        session.close()
        if conn and not conn.closed:
            conn.close()
            log("debug", "Database connection closed")
    
    return ("OK", 200)