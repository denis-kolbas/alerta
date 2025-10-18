# Renaming Summary: braze-alert-analyzer → event-analyzer

## What Changed

The alert analyzer has been renamed to be integration-agnostic:

### Old Name
- `braze-alert-analyzer` (Braze-specific)

### New Name
- `event-analyzer` (Universal for all integrations)

## Files Updated

### Directory Renamed
- `gcp/braze-alert-analyzer/` → `gcp/event-analyzer/`

### Function Names
- `braze_alert_analyzer()` → `event_analyzer()`
- Log function name: `"braze-alert-analyzer"` → `"event-analyzer"`

### Deployment
- Function name in GCP: `braze-alert-analyzer` → `event-analyzer`
- Entry point: `braze_alert_analyzer` → `event_analyzer`

### Documentation
- All README files updated
- FLOW.md updated
- Main README.md updated
- Deploy scripts updated

## Why This Change?

The analyzer works with event data from ANY integration (Braze, Mixpanel, Klaviyo, etc.), not just Braze. The new name reflects this universal capability.

## Deployment Impact

When you deploy, you'll create a NEW function called `event-analyzer`. The old `braze-alert-analyzer` (if it exists) can be deleted after the new one is working.

To delete old function (after new one is deployed):
```bash
gcloud functions delete braze-alert-analyzer \
  --gen2 \
  --region=us-central1 \
  --project=gen-lang-client-0044777751
```

## No Code Changes Needed

The analyzer logic is exactly the same - it still:
- Analyzes event data from any source
- Creates alerts for silence/spike/drop
- Auto-resolves when conditions clear
- Works with the same database tables

Only the name changed!
