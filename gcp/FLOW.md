# Complete Data Flow

## Hourly Event Processing + Alert Detection

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLOUD SCHEDULER                          │
│                    (Every hour: 0 * * * *)                       │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ HTTP POST
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   braze-event-dispatcher                         │
│                                                                  │
│  1. Connects to Supabase                                        │
│  2. SELECT * FROM clients WHERE is_active = true                │
│  3. Decrypts braze_api_key for each client                     │
│  4. For each client, publishes message:                         │
│     {                                                            │
│       "brand_name": "Bark",                                     │
│       "instance_url": "rest.iad-07.braze.com",                 │
│       "api_key": "decrypted_key"                               │
│     }                                                            │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ Pub/Sub: braze-event-processing-queue
                             │ (One message per client)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    braze-event-worker                            │
│                                                                  │
│  1. Receives client config from Pub/Sub                         │
│  2. Calls Braze API: GET /events/list                          │
│     → Returns: ["session.start", "purchase", ...]              │
│  3. For each event:                                             │
│     - GET /events/data_series (last 1 hour)                    │
│     - INSERT INTO event_data (brand, event_name, timestamp,    │
│       count)                                                    │
│  4. After ALL events processed successfully:                    │
│     Publishes message:                                          │
│     {                                                            │
│       "brand_name": "Bark",                                     │
│       "events_processed": ["session.start", "purchase", ...],  │
│       "timestamp": "2024-10-18T12:00:00Z"                      │
│     }                                                            │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ Pub/Sub: alert-analysis-queue
                             │ (One message per client)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   event-analyzer (universal)                     │
│                                                                  │
│  1. Receives brand_name + events_processed                      │
│  2. For each event:                                             │
│     a. SELECT * FROM event_data                                 │
│        WHERE brand = ? AND event_name = ?                       │
│        AND timestamp >= NOW() - INTERVAL '168 hours'            │
│     b. Skip if < 24 data points                                 │
│     c. Calculate baseline:                                      │
│        - avg_count, stddev_count                               │
│        - max_silence_hours                                      │
│     d. Check 3 rules:                                           │
│        ┌─────────────────────────────────────────┐            │
│        │ RULE 1: Silence Detection               │            │
│        │ IF current_silence > max_silence * 1.5  │            │
│        │ THEN create alert                        │            │
│        └─────────────────────────────────────────┘            │
│        ┌─────────────────────────────────────────┐            │
│        │ RULE 2: Spike Detection                 │            │
│        │ IF count > avg + (3 * stddev)           │            │
│        │ THEN create alert                        │            │
│        └─────────────────────────────────────────┘            │
│        ┌─────────────────────────────────────────┐            │
│        │ RULE 3: Drop Detection                  │            │
│        │ IF count < avg - (3 * stddev) AND > 0   │            │
│        │ THEN create alert                        │            │
│        └─────────────────────────────────────────┘            │
│     e. Check for existing unresolved alert                      │
│     f. If condition cleared, auto-resolve existing alert        │
│     g. If condition triggered, create new alert:                │
│        INSERT INTO alerts (brand_name, event_name,             │
│          rule_type, severity, message, metadata)               │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  ALERTS TABLE   │
                    │  (Supabase)     │
                    └─────────────────┘
```

## Message Formats

### Dispatcher → Worker
```json
{
  "brand_name": "Bark",
  "instance_url": "rest.iad-07.braze.com",
  "api_key": "sk_live_abc123..."
}
```

### Worker → Event Analyzer
```json
{
  "brand_name": "Bark",
  "events_processed": [
    "session.start",
    "session.end",
    "purchase.complete",
    "email.open"
  ],
  "timestamp": "2024-10-18T12:00:00Z"
}
```

## Database Tables Used

### Input: `clients`
```sql
SELECT brand_name, braze_instance_url, 
       pgp_sym_decrypt(braze_api_key, 'ENC_KEY') as api_key
FROM clients
WHERE is_active = true;
```

### Input: `event_data`
```sql
SELECT timestamp, count
FROM event_data
WHERE brand = 'Bark' 
  AND event_name = 'session.start'
  AND timestamp >= NOW() - INTERVAL '168 hours'
ORDER BY timestamp ASC;
```

### Output: `alerts`
```sql
INSERT INTO alerts (
  brand_name, 
  event_name, 
  rule_type, 
  severity, 
  message, 
  metadata
) VALUES (
  'Bark',
  'session.start',
  'silence_detection',
  'critical',
  'session.start has been silent for 8 hours (typical max: 4h)',
  '{"current_silence_hours": 8, "baseline_max_silence_hours": 4, "multiplier": 2.0}'
);
```

## Timing Example

```
12:00 - Scheduler triggers dispatcher
12:01 - Dispatcher publishes 5 client jobs
12:02 - Worker 1 processes Client A (30 events)
12:03 - Worker 1 publishes to event analyzer
12:03 - Event analyzer processes Client A
12:04 - 2 alerts created for Client A
12:05 - Worker 2 processes Client B (25 events)
12:06 - Worker 2 publishes to event analyzer
12:06 - Event analyzer processes Client B
12:07 - 0 alerts created for Client B (all normal)
...
12:15 - All clients processed
```

## Error Handling

- **Worker fails:** Doesn't publish to event analyzer (no alerts for that run)
- **Event analyzer fails:** Doesn't affect worker (events still saved)
- **Partial worker failure:** Still publishes successfully processed events
- **Alert creation fails:** Logs error, continues with other events
