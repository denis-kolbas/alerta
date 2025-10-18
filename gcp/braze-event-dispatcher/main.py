import json
import os
import logging
import psycopg2
from google.cloud import pubsub_v1

# --- Config ---
PROJECT_ID = "gen-lang-client-0044777751"

# Map integration types to their Pub/Sub topics
INTEGRATION_TOPICS = {
    "braze": "braze-event-processing-queue",
    "mixpanel": "mixpanel-event-processing-queue",  # Future
    "klaviyo": "klaviyo-event-processing-queue",    # Future
}

# --- Structured Logging ---
def log(level, message, **kwargs):
    entry = {"severity": level.upper(), "function": "event-dispatcher", "message": message}
    if kwargs:
        entry.update(kwargs)
    print(json.dumps(entry))

def summarize_list(items, limit=5):
    """Returns a readable summary of long lists."""
    if len(items) <= limit:
        return items
    return items[:limit] + [f"...(+{len(items)-limit} more)"]

def event_dispatcher(request):
    """Triggered by Pub/Sub or HTTP to fetch all integration configs and publish to appropriate worker queues."""
    envelope = request.get_json(silent=True)
    if not envelope or 'message' not in envelope:
        log("warning", "Received invalid request (not from Pub/Sub)")
        return ("OK", 200)

    log("info", "Dispatcher started execution (all integrations)")

    # 1. Load secrets
    try:
        db_uri = os.environ.get("SUPABASE_CONNECTION_URI")
        encryption_key = os.environ.get("PGCRYPTO_ENCRYPTION_KEY")
        if not db_uri or not encryption_key:
            raise ValueError("Database URI or encryption key missing")
        log("info", "Loaded secrets from environment")
    except Exception as e:
        log("error", "Failed to get secrets", error=str(e))
        return ("Internal Server Error: Configuration failed", 500)

    # 2. Fetch clients
    clients_to_process = []
    conn = None
    try:
        conn = psycopg2.connect(db_uri)
        with conn.cursor() as cur:
            log("info", "Fetching all active integrations from database")
            query = """
                SELECT 
                    id,
                    integration_name,
                    brand_name, 
                    braze_instance_url, 
                    braze_api_key
                FROM clients
                WHERE is_active = true;
            """
            cur.execute(query)
            for row in cur.fetchall():
                client_id = row[0]
                integration_name = row[1]
                brand_name = row[2]
                instance_url = row[3]
                encrypted_api_key = row[4]
                
                # Decrypt API key
                try:
                    if encrypted_api_key:
                        decrypt_query = "SELECT pgp_sym_decrypt(%s, %s);"
                        cur.execute(decrypt_query, (encrypted_api_key, encryption_key))
                        api_key = cur.fetchone()[0]
                    else:
                        api_key = None
                except Exception as e:
                    log("error", "Failed to decrypt API key", 
                        brand=brand_name, 
                        integration=integration_name,
                        error=str(e))
                    continue
                
                # Build config based on integration type
                if integration_name == 'braze':
                    if instance_url and api_key:  # Has instance_url and api_key
                        clients_to_process.append({
                            "integration_name": integration_name,
                            "brand_name": brand_name,
                            "instance_url": instance_url,
                            "api_key": api_key
                        })
                # Future: Add elif for mixpanel, klaviyo, etc.
                else:
                    log("warning", "Unknown integration type", 
                        integration=integration_name, 
                        brand=brand_name)
        client_brands = [c["brand_name"] for c in clients_to_process]
        log("info", "Fetched clients successfully",
            count=len(clients_to_process),
            clients=summarize_list(client_brands))
    except Exception as e:
        log("error", "Failed to fetch clients", error=str(e))
        return ("Internal Server Error: Database query failed", 500)
    finally:
        if conn:
            conn.close()

    if not clients_to_process:
        log("info", "No active clients found")
        return ("OK", 200)

    # 3. Publish messages to appropriate topics
    publisher = pubsub_v1.PublisherClient()
    published_count = 0
    failed_clients = []
    published_by_integration = {}

    futures = []
    for client in clients_to_process:
        integration_name = client.get("integration_name")
        topic_name = INTEGRATION_TOPICS.get(integration_name)
        
        if not topic_name:
            log("error", "No topic configured for integration", 
                integration=integration_name, 
                brand=client.get("brand_name"))
            failed_clients.append(f"{client.get('brand_name')} ({integration_name})")
            continue
        
        topic_path = publisher.topic_path(PROJECT_ID, topic_name)
        futures.append((client, publisher.publish(topic_path, data=json.dumps(client).encode("utf-8"))))

    for client, future in futures:
        brand = client.get("brand_name", "unknown")
        integration = client.get("integration_name", "unknown")
        try:
            future.result(timeout=15)
            published_count += 1
            published_by_integration[integration] = published_by_integration.get(integration, 0) + 1
            log("info", "Published job", brand=brand, integration=integration)
        except Exception as e:
            log("error", "Failed to publish job", brand=brand, integration=integration, error=str(e))
            failed_clients.append(f"{brand} ({integration})")

    log("info", "Publishing complete",
        published=published_count,
        total=len(clients_to_process),
        by_integration=published_by_integration,
        failed_clients=failed_clients or None)

    if failed_clients:
        log("warning", "Partial failure", failed_clients=failed_clients)
        return (json.dumps({"status": "partial", "failed_clients": failed_clients}), 200)

    log("info", "Dispatcher finished successfully")
    return ("OK", 200)
