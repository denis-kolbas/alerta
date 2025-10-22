import functions_framework
import psycopg2
from psycopg2.extras import RealDictCursor
import os
import json
from datetime import datetime, timedelta
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import base64

# --- Structured Logging ---
def log(level, message, **kwargs):
    entry = {"severity": level.upper(), "function": "alert-notifier", "message": message}
    if kwargs:
        entry.update(kwargs)
    print(json.dumps(entry))

# --- HTTP Session ---
def get_session_with_retries():
    """Create HTTP session with retry logic for Resend API"""
    session = requests.Session()
    retry_strategy = Retry(
        total=3,
        backoff_factor=1,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["POST"]
    )
    adapter = HTTPAdapter(max_retries=retry_strategy)
    session.mount("https://", adapter)
    return session

# --- Database connection ---
def get_db_connection():
    db_uri = os.environ.get("SUPABASE_CONNECTION_URI")
    if not db_uri:
        raise ValueError("SUPABASE_CONNECTION_URI not found")
    return psycopg2.connect(db_uri, connect_timeout=10)

# --- Configuration ---
RESEND_API_KEY = os.environ.get('RESEND_API_KEY')
if not RESEND_API_KEY:
    log("error", "RESEND_API_KEY not configured")
    raise ValueError("RESEND_API_KEY not found")

BASE_URL = os.environ.get('BASE_URL', 'https://vibebench.io')

def send_email(session, to_email, subject, html_content):
    """Send email via Resend API with retry logic"""
    try:
        response = session.post(
            'https://api.resend.com/emails',
            headers={
                'Authorization': f'Bearer {RESEND_API_KEY}',
                'Content-Type': 'application/json'
            },
            json={
                'from': 'Alerta <noreply@vibebench.io>',
                'to': [to_email],
                'subject': subject,
                'html': html_content
            },
            timeout=(5, 20)
        )
        response.raise_for_status()
        return True
    except requests.exceptions.RequestException as e:
        log("error", "Failed to send email", email=to_email, error=str(e))
        return False

def format_alert_html(alert):
    """Format a single alert as HTML"""
    severity_colors = {
        'critical': '#dc2626',
        'warning': '#ea580c',
        'info': '#2563eb'
    }
    color = severity_colors.get(alert['severity'], '#6b7280')
    
    return f"""
    <div style="border-left: 4px solid {color}; padding: 16px; margin-bottom: 16px; background-color: #f9fafb; border-radius: 4px;">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
            <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #111827;">{alert['event_name']}</h3>
            <span style="background-color: {color}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px; text-transform: uppercase;">
                {alert['severity']}
            </span>
        </div>
        <p style="margin: 8px 0; color: #374151; font-size: 14px;">{alert['message']}</p>
        <div style="display: flex; gap: 16px; margin-top: 8px; font-size: 12px; color: #6b7280;">
            <span>Integration: <strong style="text-transform: capitalize;">{alert.get('integration_name', 'Unknown')}</strong></span>
            <span>Type: <strong>{alert['rule_type'].replace('_', ' ').title()}</strong></span>
            <span>Time: <strong>{alert['created_at'].strftime('%Y-%m-%d %H:%M UTC')}</strong></span>
        </div>
    </div>
    """

def create_email_html(alerts, team_name):
    """Create email HTML for single or multiple alerts"""
    alert_count = len(alerts)
    
    if alert_count == 1:
        subject = f"New Alert: {alerts[0]['event_name']}"
        title = "New Alert Detected"
    else:
        subject = f"{alert_count} New Alerts Detected"
        title = f"{alert_count} New Alerts"
    
    alerts_html = ''.join([format_alert_html(alert) for alert in alerts])
    
    html = f"""
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f9fafb; border-radius: 8px; padding: 32px; margin-bottom: 24px;">
          <h1 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 600; color: #111827;">
            {title}
          </h1>
          <p style="margin: 0 0 24px 0; font-size: 14px; color: #6b7280;">
            Team: {team_name}
          </p>
          {alerts_html}
          <a href="{BASE_URL}/dashboard/alerts" style="display: inline-block; background-color: #ff4f00; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 14px; margin-top: 16px;">
            View All Alerts
          </a>
        </div>
        <div style="font-size: 12px; color: #6b7280; text-align: center;">
          <p style="margin: 0 0 8px 0;">
            You're receiving this because you have alert notifications enabled.
          </p>
          <p style="margin: 0;">
            <a href="{BASE_URL}/dashboard/account" style="color: #6b7280; text-decoration: underline;">
              Manage notification preferences
            </a>
          </p>
        </div>
      </body>
    </html>
    """
    
    return subject, html

@functions_framework.cloud_event
def alert_notifier(cloud_event):
    """
    Triggered by Pub/Sub when event-analyzer completes.
    Processes new alerts and sends email notifications.
    """
    log("info", "Alert notifier triggered", timestamp=datetime.utcnow().isoformat())
    
    conn = None
    session = get_session_with_retries()
    
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # Get all active alerts that haven't been notified yet
        cur.execute("""
            SELECT DISTINCT a.*, c.integration_name, c.team_id
            FROM alerts a
            JOIN clients c ON a.client_id = c.id
            LEFT JOIN alert_notifications an ON a.id = an.alert_id
            WHERE a.status = 'active'
            AND (an.id IS NULL OR an.status IN ('pending', 'failed'))
            ORDER BY a.created_at DESC
        """)
        
        unnotified_alerts = cur.fetchall()
        log("info", "Found unnotified alerts", count=len(unnotified_alerts))
        
        if not unnotified_alerts:
            log("info", "No unnotified alerts to process")
            return
        
        # Group alerts by team
        alerts_by_team = {}
        for alert in unnotified_alerts:
            team_id = alert['team_id']
            if team_id not in alerts_by_team:
                alerts_by_team[team_id] = []
            alerts_by_team[team_id].append(alert)
        
        # Process each team
        for team_id, team_alerts in alerts_by_team.items():
            # Get team info and members
            cur.execute("""
                SELECT t.name, u.id as user_id, u.email, u.alert_email_preference, tm.role
                FROM teams t
                JOIN team_members tm ON t.id = tm.team_id
                JOIN users u ON tm.user_id = u.id
                WHERE t.id = %s
            """, (team_id,))
            
            team_members = cur.fetchall()
            if not team_members:
                continue
            
            team_name = team_members[0]['name']
            
            # Process each team member
            for member in team_members:
                user_id = member['user_id']
                email = member['email']
                preference = member['alert_email_preference']
                
                # Skip if user doesn't want emails
                if preference == 'none':
                    continue
                
                # Filter alerts based on preference
                user_alerts = team_alerts
                if preference == 'critical_only':
                    user_alerts = [a for a in team_alerts if a['severity'] == 'critical']
                
                if not user_alerts:
                    continue
                
                # Check which alerts haven't been notified yet
                alert_ids = [a['id'] for a in user_alerts]
                cur.execute("""
                    SELECT alert_id FROM alert_notifications
                    WHERE user_id = %s AND alert_id = ANY(%s)
                """, (user_id, alert_ids))
                
                notified_alert_ids = {row['alert_id'] for row in cur.fetchall()}
                new_alerts = [a for a in user_alerts if a['id'] not in notified_alert_ids]
                
                if not new_alerts:
                    continue
                
                # Check if user received email in last 5 minutes (for grouping)
                five_min_ago = datetime.utcnow() - timedelta(minutes=5)
                cur.execute("""
                    SELECT MAX(sent_at) as last_sent
                    FROM alert_notifications
                    WHERE user_id = %s AND sent_at >= %s AND status = 'sent'
                """, (user_id, five_min_ago))
                
                last_sent = cur.fetchone()['last_sent']
                
                if last_sent:
                    # User received email recently, mark as pending for next batch
                    log("info", "Queuing alerts for batching", email=email, alert_count=len(new_alerts))
                    for alert in new_alerts:
                        cur.execute("""
                            INSERT INTO alert_notifications (alert_id, user_id, status)
                            VALUES (%s, %s, 'pending')
                            ON CONFLICT (alert_id, user_id) DO NOTHING
                        """, (alert['id'], user_id))
                else:
                    # Check for any pending alerts to include in this email
                    cur.execute("""
                        SELECT a.* FROM alerts a
                        JOIN alert_notifications an ON a.id = an.alert_id
                        WHERE an.user_id = %s AND an.status = 'pending'
                    """, (user_id,))
                    
                    pending_alerts = cur.fetchall()
                    all_alerts_to_send = new_alerts + pending_alerts
                    
                    # Send email
                    subject, html = create_email_html(all_alerts_to_send, team_name)
                    success = send_email(session, email, subject, html)
                    
                    if success:
                        log("info", "Sent email", email=email, alert_count=len(all_alerts_to_send))
                        # Mark all as sent
                        for alert in all_alerts_to_send:
                            cur.execute("""
                                INSERT INTO alert_notifications (alert_id, user_id, status, sent_at)
                                VALUES (%s, %s, 'sent', NOW())
                                ON CONFLICT (alert_id, user_id) 
                                DO UPDATE SET status = 'sent', sent_at = NOW()
                            """, (alert['id'], user_id))
                    else:
                        log("error", "Failed to send email", email=email)
                        # Mark as failed
                        for alert in new_alerts:
                            cur.execute("""
                                INSERT INTO alert_notifications (alert_id, user_id, status)
                                VALUES (%s, %s, 'failed')
                                ON CONFLICT (alert_id, user_id) DO NOTHING
                            """, (alert['id'], user_id))
        
        conn.commit()
        log("info", "Alert notification processing complete")
        
    except Exception as e:
        log("error", "Error processing alerts", error=str(e))
        if conn:
            conn.rollback()
        raise
    finally:
        if conn:
            try:
                cur.close()
                conn.close()
                log("info", "Database connection closed")
            except Exception as e:
                log("warning", "Error closing database connection", error=str(e))
        try:
            session.close()
        except Exception as e:
            log("warning", "Error closing HTTP session", error=str(e))
