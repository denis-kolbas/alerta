# Alert Notifier Deployment Instructions

## Prerequisites
1. GCP Project with Cloud Functions enabled
2. Pub/Sub topic created: `alert-notifications`
3. Database connection string
4. Resend API key

## GCP Console Deployment Steps

### 1. Create Pub/Sub Topic (if not exists)
1. Go to **Pub/Sub** > **Topics**
2. Click **CREATE TOPIC**
3. Topic ID: `alert-notifications`
4. Click **CREATE**

### 2. Deploy Cloud Function

1. Go to **Cloud Functions** in GCP Console
2. Click **CREATE FUNCTION**

#### Configuration Tab:
- **Function name**: `alert-notifier`
- **Region**: Choose same as event-analyzer (e.g., `us-central1`)
- **Trigger type**: **Cloud Pub/Sub**
- **Select a Cloud Pub/Sub topic**: `alert-notifications`
- **Runtime service account**: Use default or create one with:
  - Cloud SQL Client (if using Cloud SQL)
  - Pub/Sub Publisher
  - Secret Manager Secret Accessor (if using secrets)

#### Runtime Tab:
- **Memory**: 256 MB
- **Timeout**: 60 seconds
- **Runtime**: Python 3.11

#### Environment Variables:
Add these in the "Runtime, build, connections and security settings" section:

```
DATABASE_URL=postgresql://user:password@host:5432/database
RESEND_API_KEY=re_your_resend_api_key
BASE_URL=https://yourdomain.com
```

**Note**: For production, use Secret Manager instead of plain environment variables!

#### Code Tab:
1. **Runtime**: Python 3.11
2. **Entry point**: `alert_notifier`
3. Upload the files:
   - `main.py` (copy content from this directory)
   - `requirements.txt` (copy content from this directory)

4. Click **DEPLOY**

### 3. Update event-analyzer Environment Variables

Add to your event-analyzer function:
```
GCP_PROJECT=your-project-id
```

### 4. Test the Setup

1. Trigger the event-analyzer (it will create alerts)
2. Check Cloud Function logs for alert-notifier
3. Verify emails are sent

## Monitoring

- **Logs**: Cloud Functions > alert-notifier > Logs
- **Metrics**: Monitor execution count, errors, duration
- **Alerts**: Set up alerting for function failures

## Troubleshooting

### No emails sent
- Check Resend API key is correct
- Verify DATABASE_URL connection
- Check user email preferences in database

### Function timeout
- Increase timeout in Runtime settings
- Check database query performance

### Pub/Sub not triggering
- Verify topic name matches: `alert-notifications`
- Check event-analyzer is publishing successfully
- Verify IAM permissions

## Security Best Practices

1. **Use Secret Manager** for sensitive data:
   ```
   DATABASE_URL -> Secret Manager
   RESEND_API_KEY -> Secret Manager
   ```

2. **Restrict service account permissions**:
   - Only grant necessary roles
   - Use separate service accounts per function

3. **Enable VPC Connector** if database is in VPC

4. **Set up monitoring and alerting** for function failures
