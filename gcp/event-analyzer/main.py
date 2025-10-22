import base64
import json
import os
from datetime import datetime, timezone, timedelta
from statistics import mean, stdev
import psycopg2
from psycopg2.extras import Json
from google.cloud import pubsub_v1

# --- Config ---
ANALYSIS_WINDOW_HOURS = 168  # 7 days
MIN_DATA_POINTS = 24  # Minimum 24 hours of data required

# --- Structured Logging ---
def log(level, message, **kwargs):
    entry = {"severity": level.upper(), "function": "event-analyzer", "message": message}
    if kwargs:
        entry.update(kwargs)
    print(json.dumps(entry))

# --- Database ---
def get_db_connection(db_uri):
    return psycopg2.connect(db_uri)

def get_event_data(conn, client_id, event_name, hours=ANALYSIS_WINDOW_HOURS):
    """Fetch event data for analysis"""
    query = """
        SELECT timestamp, count
        FROM event_data
        WHERE client_id = %s 
          AND event_name = %s 
          AND timestamp >= NOW() - INTERVAL '%s hours'
        ORDER BY timestamp ASC;
    """
    with conn.cursor() as cur:
        cur.execute(query, (client_id, event_name, hours))
        return cur.fetchall()

def check_existing_alert(conn, brand_name, event_name, rule_type):
    """Check if unresolved alert exists for this brand/event/rule in last 24h"""
    query = """
        SELECT id, created_at
        FROM alerts
        WHERE brand_name = %s 
          AND event_name = %s 
          AND rule_type = %s
          AND is_resolved = false
          AND created_at >= NOW() - INTERVAL '24 hours'
        LIMIT 1;
    """
    with conn.cursor() as cur:
        cur.execute(query, (brand_name, event_name, rule_type))
        result = cur.fetchone()
        return {"id": result[0], "created_at": result[1]} if result else None

def create_alert(conn, client_id, brand_name, event_name, rule_type, severity, message, metadata):
    """Create a new alert"""
    if not client_id:
        log("error", "Client ID not provided")
        return None
    
    query = """
        INSERT INTO alerts (client_id, brand_name, event_name, rule_type, severity, message, metadata, status, is_resolved)
        VALUES (%s, %s, %s, %s, %s, %s, %s, 'active', false)
        RETURNING id;
    """
    with conn.cursor() as cur:
        cur.execute(query, (client_id, brand_name, event_name, rule_type, severity, message, Json(metadata)))
        conn.commit()
        return cur.fetchone()[0]

# auto_resolve_alert function removed - alerts should only be resolved manually by users

# --- Baseline Calculation ---
def calculate_baseline(data_points):
    """Calculate baseline metrics from historical data"""
    if len(data_points) < 2:
        return None
    
    counts = [count for _, count in data_points]
    
    # Calculate silence periods
    silence_periods = []
    current_silence = 0
    for count in counts:
        if count == 0:
            current_silence += 1
        else:
            if current_silence > 0:
                silence_periods.append(current_silence)
            current_silence = 0
    if current_silence > 0:
        silence_periods.append(current_silence)
    
    # Calculate statistics
    avg_count = mean(counts)
    stddev_count = stdev(counts) if len(counts) > 1 else 0
    max_silence = max(silence_periods) if silence_periods else 0
    avg_silence = mean(silence_periods) if silence_periods else 0
    
    return {
        "avg_count": round(avg_count, 2),
        "stddev_count": round(stddev_count, 2),
        "max_silence_hours": max_silence,
        "avg_silence_hours": round(avg_silence, 2),
        "total_data_points": len(data_points)
    }

def count_current_silence(data_points):
    """Count how many consecutive hours the event has been at zero (from the end)"""
    silence_hours = 0
    for timestamp, count in reversed(data_points):
        if count == 0:
            silence_hours += 1
        else:
            break
    return silence_hours

# --- Alert Rules ---
def check_silence_detection(conn, client_id, brand_name, event_name, data_points, baseline):
    """Rule 1: Detect when event is silent longer than normal"""
    current_silence = count_current_silence(data_points)
    max_silence = baseline["max_silence_hours"]
    
    # Skip if no silence or within normal range
    if current_silence == 0 or current_silence <= max_silence * 1.5:
        # Condition cleared - don't create new alert, but don't auto-resolve either
        # Alerts should only be resolved manually by users
        return None
    
    # Calculate severity
    multiplier = current_silence / max_silence if max_silence > 0 else 999
    severity = "critical" if multiplier >= 2.0 else "warning"
    
    # Check for existing alert (avoid duplicates)
    existing = check_existing_alert(conn, brand_name, event_name, "silence_detection")
    if existing:
        return None
    
    # Create alert
    message = f"{event_name} has been silent for {current_silence} hours (typical max: {max_silence}h)"
    metadata = {
        "current_silence_hours": current_silence,
        "baseline_max_silence_hours": max_silence,
        "multiplier": round(multiplier, 2),
        "last_non_zero_timestamp": None  # Could add this if needed
    }
    
    alert_id = create_alert(conn, client_id, brand_name, event_name, "silence_detection", severity, message, metadata)
    log("warning", "Created silence detection alert", 
        brand=brand_name, event=event_name, alert_id=alert_id, severity=severity)
    return alert_id

def check_spike_detection(conn, client_id, brand_name, event_name, data_points, baseline):
    """Rule 2: Detect when event count spikes above normal"""
    current_count = data_points[-1][1]  # Most recent count
    threshold = baseline["avg_count"] + (3 * baseline["stddev_count"])
    
    # Skip if within normal range
    if current_count <= threshold:
        # Condition cleared - don't create new alert, but don't auto-resolve either
        # Alerts should only be resolved manually by users
        return None
    
    # Calculate how many standard deviations above
    stddev_multiplier = (current_count - baseline["avg_count"]) / baseline["stddev_count"] if baseline["stddev_count"] > 0 else 999
    
    # Check for existing alert
    existing = check_existing_alert(conn, brand_name, event_name, "spike_detection")
    if existing:
        return None
    
    # Create alert
    message = f"{event_name} spike detected: {current_count} events (normal: {baseline['avg_count']:.0f})"
    metadata = {
        "current_count": current_count,
        "baseline_avg": baseline["avg_count"],
        "baseline_stddev": baseline["stddev_count"],
        "threshold": round(threshold, 2),
        "stddev_multiplier": round(stddev_multiplier, 2)
    }
    
    alert_id = create_alert(conn, client_id, brand_name, event_name, "spike_detection", "warning", message, metadata)
    log("warning", "Created spike detection alert", 
        brand=brand_name, event=event_name, alert_id=alert_id)
    return alert_id

def check_drop_detection(conn, client_id, brand_name, event_name, data_points, baseline):
    """Rule 3: Detect when event count drops below normal (but not zero)"""
    current_count = data_points[-1][1]  # Most recent count
    threshold = baseline["avg_count"] - (3 * baseline["stddev_count"])
    
    # Skip if zero (that's silence detection) or within normal range
    if current_count == 0 or current_count >= threshold:
        # Condition cleared - don't create new alert, but don't auto-resolve either
        # Alerts should only be resolved manually by users
        return None
    
    # Calculate how many standard deviations below
    stddev_multiplier = (baseline["avg_count"] - current_count) / baseline["stddev_count"] if baseline["stddev_count"] > 0 else 999
    
    # Check for existing alert
    existing = check_existing_alert(conn, brand_name, event_name, "drop_detection")
    if existing:
        return None
    
    # Create alert
    message = f"{event_name} drop detected: {current_count} events (normal: {baseline['avg_count']:.0f})"
    metadata = {
        "current_count": current_count,
        "baseline_avg": baseline["avg_count"],
        "baseline_stddev": baseline["stddev_count"],
        "threshold": round(threshold, 2),
        "stddev_multiplier": round(stddev_multiplier, 2)
    }
    
    alert_id = create_alert(conn, client_id, brand_name, event_name, "drop_detection", "warning", message, metadata)
    log("warning", "Created drop detection alert", 
        brand=brand_name, event=event_name, alert_id=alert_id)
    return alert_id

# --- Main Function ---
def event_analyzer(request):
    """Analyze event data and create alerts for anomalies"""
    envelope = request.get_json(silent=True)
    if not envelope or "message" not in envelope:
        log("warning", "Invalid request")
        return ("OK", 200)

    try:
        pubsub_message = envelope["message"]
        analysis_job = json.loads(base64.b64decode(pubsub_message["data"]).decode("utf-8"))
        brand_name = analysis_job["brand_name"]
        integration_name = analysis_job.get("integration_name", "unknown")
        client_id = analysis_job.get("client_id")
        events_processed = analysis_job["events_processed"]
        log("info", "Received analysis job", 
            brand=brand_name,
            integration=integration_name,
            client_id=client_id,
            event_count=len(events_processed))
    except Exception as e:
        log("error", "Failed to decode Pub/Sub message", error=str(e))
        return ("Bad Request", 200)

    conn = None
    try:
        db_uri = os.environ.get("SUPABASE_CONNECTION_URI")
        if not db_uri:
            raise ValueError("SUPABASE_CONNECTION_URI not found")

        conn = get_db_connection(db_uri)
        log("info", "Connected to database", client_id=client_id, brand=brand_name)

        alerts_created = 0
        alerts_resolved = 0
        events_analyzed = 0
        events_skipped = 0

        for event_name in events_processed:
            try:
                # Fetch historical data
                data_points = get_event_data(conn, client_id, event_name)
                
                # Skip if insufficient data
                if len(data_points) < MIN_DATA_POINTS:
                    events_skipped += 1
                    continue
                
                # Calculate baseline
                baseline = calculate_baseline(data_points)
                if not baseline:
                    events_skipped += 1
                    continue
                
                # Run all three rules
                result1 = check_silence_detection(conn, client_id, brand_name, event_name, data_points, baseline)
                result2 = check_spike_detection(conn, client_id, brand_name, event_name, data_points, baseline)
                result3 = check_drop_detection(conn, client_id, brand_name, event_name, data_points, baseline)
                
                if result1 or result2 or result3:
                    alerts_created += sum([1 for r in [result1, result2, result3] if r])
                
                events_analyzed += 1
                
            except Exception as e:
                log("error", "Failed to analyze event", 
                    client_id=client_id,
                    brand=brand_name, 
                    event=event_name, 
                    error=str(e))
                continue

        log("info", "Analysis complete", 
            client_id=client_id,
            brand=brand_name,
            events_analyzed=events_analyzed,
            events_skipped=events_skipped,
            alerts_created=alerts_created)
        
        # Publish to Pub/Sub to trigger alert notifier if alerts were created
        if alerts_created > 0:
            try:
                project_id = "gen-lang-client-0044777751"
                topic_name = "alert-notifications"
                
                publisher = pubsub_v1.PublisherClient()
                topic_path = publisher.topic_path(project_id, topic_name)
                
                message_data = json.dumps({
                    "brand_name": brand_name,
                    "alerts_created": alerts_created,
                    "timestamp": datetime.utcnow().isoformat()
                }).encode("utf-8")
                
                future = publisher.publish(topic_path, message_data)
                future.result()  # Wait for publish to complete
                
                log("info", "Published to alert-notifications topic", 
                    client_id=client_id, brand=brand_name, alerts_created=alerts_created)
            except Exception as pub_error:
                log("error", "Failed to publish to Pub/Sub", error=str(pub_error))
                # Don't fail the whole function if Pub/Sub fails

    except Exception as e:
        log("error", "Fatal error in analyzer", client_id=client_id if 'client_id' in locals() else None, brand=brand_name if 'brand_name' in locals() else None, error=str(e))
        raise
    finally:
        if conn:
            conn.close()
            log("info", "Database connection closed", client_id=client_id if 'client_id' in locals() else None, brand=brand_name if 'brand_name' in locals() else None)

    return ("OK", 200)
