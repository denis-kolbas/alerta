import json
import os
import hashlib
from typing import List, Dict, Tuple
from collections import defaultdict
import psycopg2
from google.cloud import pubsub_v1

# --- Config ---
PROJECT_ID = os.environ.get("GCP_PROJECT_ID", "gen-lang-client-0044777751")
DB_TIMEOUT = 10
PUBLISH_TIMEOUT = 15
MAX_CLIENTS_TO_LOG = 5


def log(level: str, message: str, **kwargs):
    """Structured logging in JSON format."""
    entry = {
        "severity": level.upper(),
        "function": "integration-event-dispatcher",
        "message": message
    }
    if kwargs:
        entry.update(kwargs)
    print(json.dumps(entry))


def hash_api_key(api_key: str) -> str:
    """Create a hash for API key identification without exposing it."""
    return hashlib.sha256(api_key.encode()).hexdigest()[:12]


def summarize_list(items: List[str], limit: int = MAX_CLIENTS_TO_LOG) -> List[str]:
    """Returns a readable summary of long lists."""
    if len(items) <= limit:
        return items
    return items[:limit] + [f"...(+{len(items)-limit} more)"]


def get_topic_name(integration_type: str) -> str:
    """
    Convert integration type to Pub/Sub topic name.
    
    Examples:
        'braze' -> 'braze-event-processing-queue'
        'klaviyo' -> 'klaviyo-event-processing-queue'
    """
    return f"{integration_type.lower()}-event-processing-queue"


def fetch_active_clients(db_uri: str, encryption_key: str) -> List[Dict[str, str]]:
    """Fetch active clients from database with decrypted API keys."""
    clients = []
    conn = None
    
    try:
        conn = psycopg2.connect(db_uri, connect_timeout=DB_TIMEOUT)
        with conn.cursor() as cur:
            log("info", "Fetching active clients from database")
            query = """
                SELECT id, brand_name, integration_name, braze_instance_url, 
                       pgp_sym_decrypt(braze_api_key, %s) AS api_key
                FROM clients
                WHERE is_active = true 
                  AND braze_api_key IS NOT NULL;
            """
            cur.execute(query, (encryption_key,))
            
            for row in cur.fetchall():
                api_key = row[4]
                clients.append({
                    "client_id": row[0],
                    "brand_name": row[1],
                    "integration_type": row[2],  # Reading from integration_name column
                    "instance_url": row[3],
                    "api_key": api_key,
                    "api_key_hash": hash_api_key(api_key)
                })
        
        # Group by integration type for logging
        by_integration = defaultdict(list)
        for c in clients:
            by_integration[c["integration_type"]].append(c["brand_name"])
        
        integration_summary = {
            integration: summarize_list(brands) 
            for integration, brands in by_integration.items()
        }
        
        log("info", "Fetched clients successfully",
            total_count=len(clients),
            by_integration=integration_summary)
        
        return clients
        
    except Exception as e:
        log("error", "Failed to fetch clients", error=str(e))
        raise
    finally:
        if conn:
            conn.close()


def publish_worker_jobs(clients: List[Dict[str, str]]) -> Tuple[Dict[str, int], List[Dict[str, str]]]:
    """
    Publish jobs to Pub/Sub, routing each client to its integration-specific topic.
    
    Returns:
        Tuple of (published_counts_by_integration, failed_clients)
    """
    publisher = pubsub_v1.PublisherClient()
    
    published_counts = defaultdict(int)
    failed_clients = []
    futures = []
    
    # Publish all messages (non-blocking)
    for client in clients:
        integration_type = client["integration_type"]
        topic_name = get_topic_name(integration_type)
        topic_path = publisher.topic_path(PROJECT_ID, topic_name)
        
        # Create message payload
        payload = {
            "client_id": client["client_id"],
            "brand_name": client["brand_name"],
            "integration_type": integration_type,
            "instance_url": client["instance_url"],
            "api_key": client["api_key"]
        }
        
        try:
            future = publisher.publish(
                topic_path,
                data=json.dumps(payload).encode("utf-8")
            )
            futures.append((client, future, topic_name))
        except Exception as e:
            # Catch topic not found errors early
            log("error", "Failed to publish job (topic may not exist)", 
                client_id=client["client_id"],
                brand=client["brand_name"],
                integration=integration_type,
                topic=topic_name,
                error=str(e))
            failed_clients.append({
                "client_id": client["client_id"],
                "brand": client["brand_name"],
                "integration": integration_type,
                "reason": str(e)
            })
    
    # Wait for all publishes to complete
    for client, future, topic_name in futures:
        client_id = client.get("client_id", "unknown")
        brand = client.get("brand_name", "unknown")
        integration_type = client.get("integration_type", "unknown")
        api_key_hash = client.get("api_key_hash", "unknown")
        
        try:
            future.result(timeout=PUBLISH_TIMEOUT)
            published_counts[integration_type] += 1
            log("info", "Published job", 
                client_id=client_id,
                brand=brand, 
                integration=integration_type,
                topic=topic_name,
                api_key_hash=api_key_hash)
        except Exception as e:
            log("error", "Failed to publish job", 
                client_id=client_id,
                brand=brand,
                integration=integration_type,
                topic=topic_name,
                api_key_hash=api_key_hash,
                error=str(e))
            failed_clients.append({
                "client_id": client_id,
                "brand": brand,
                "integration": integration_type,
                "reason": str(e)
            })
    
    return dict(published_counts), failed_clients


def integration_event_dispatcher(request) -> Tuple[str, int]:
    """
    Triggered by Pub/Sub to fetch client configs and publish worker jobs.
    Routes each client to its integration-specific Pub/Sub topic.
    
    Args:
        request: Flask request object (Pub/Sub push or HTTP)
    
    Returns:
        Tuple of (response_body, status_code)
    """
    # Validate Pub/Sub message format
    envelope = request.get_json(silent=True)
    if not envelope or 'message' not in envelope:
        log("warning", "Received invalid request (not from Pub/Sub)")
        return ("Bad Request: Invalid Pub/Sub message", 400)
    
    log("info", "Dispatcher started execution")
    
    # Load configuration
    try:
        db_uri = os.environ.get("SUPABASE_CONNECTION_URI")
        encryption_key = os.environ.get("PGCRYPTO_ENCRYPTION_KEY")
        
        if not db_uri or not encryption_key:
            raise ValueError("Missing required environment variables")
        
        log("info", "Configuration loaded successfully")
    except Exception as e:
        log("error", "Failed to load configuration", error=str(e))
        return ("Internal Server Error: Configuration failed", 500)
    
    # Fetch active clients
    try:
        clients_to_process = fetch_active_clients(db_uri, encryption_key)
    except Exception as e:
        return ("Internal Server Error: Database query failed", 500)
    
    if not clients_to_process:
        log("info", "No active clients found")
        return ("OK", 200)
    
    # Publish worker jobs
    try:
        published_counts, failed_clients = publish_worker_jobs(clients_to_process)
    except Exception as e:
        log("error", "Failed to publish jobs", error=str(e))
        return ("Internal Server Error: Publishing failed", 500)
    
    total_published = sum(published_counts.values())
    total_clients = len(clients_to_process)
    
    log("info", "Publishing complete",
        total_published=total_published,
        total_clients=total_clients,
        by_integration=published_counts,
        failed_count=len(failed_clients))
    
    # Return appropriate response
    if failed_clients:
        log("warning", "Partial failure", failed_clients=failed_clients)
        return (json.dumps({
            "status": "partial",
            "published": total_published,
            "total": total_clients,
            "by_integration": published_counts,
            "failed_clients": failed_clients
        }), 207)  # 207 Multi-Status for partial success
    
    log("info", "Dispatcher finished successfully", by_integration=published_counts)
    return (json.dumps({
        "status": "success",
        "published": total_published,
        "by_integration": published_counts
    }), 200)