# Klaviyo Event Worker

Fetches metrics (events) and their hourly counts from Klaviyo API.

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Create `.env` file with your Klaviyo API key:
```bash
cp .env.example .env
# Edit .env and add your KLAVIYO_API_KEY
```

3. Get your Klaviyo Private API Key:
   - Go to Klaviyo Settings > API Keys
   - Create a new Private API Key with `events:read` and `metrics:read` scopes

## Usage

Run the script to fetch all metrics and their event counts for the last hour:

```bash
python fetch_klaviyo_events.py
```

The script will:
1. Fetch all available metrics from your Klaviyo account
2. Query hourly event counts for each metric
3. Display a summary and save results to `klaviyo_events.json`

## Output Format

The script generates a JSON file with this structure:

```json
[
  {
    "metric_name": "Opened Email",
    "timestamp": "2025-10-18T14:00:00+00:00",
    "count": 1234
  },
  ...
]
```
