import requests
import os
import json
from datetime import datetime, timedelta, timezone

# --- CONFIGURATION ---
# It's recommended to set these as environment variables for security.
CONFIG = {
    "BRAZE_API_KEY": os.environ.get("BRAZE_API_KEY", "27dae9ad-0324-465f-8bb4-8ef0740e34ec"),
    "BRAZE_API_URL": os.environ.get("BRAZE_API_URL", "https://rest.iad-07.braze.com"),
    
    # --- Scout's Discovery Rules ---
    # How many days in the future should we look for scheduled campaigns?
    "SCHEDULED_LOOKAHEAD_DAYS": 7
}

def braze_api_request(endpoint, params=None):
    """
    Makes a GET request to the Braze API with authentication and handles errors.
    """
    headers = {
        "Authorization": f"Bearer {CONFIG['BRAZE_API_KEY']}",
        "Content-Type": "application/json"
    }
    try:
        response = requests.get(
            f"{CONFIG['BRAZE_API_URL']}{endpoint}",
            headers=headers,
            params=params
        )
        response.raise_for_status()  # Raises an HTTPError for bad responses (4xx or 5xx)
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error calling Braze API endpoint {endpoint}: {e}")
        return None

def discover_campaigns_to_monitor():
    """
    Acts as the "Scout". It fetches all campaigns from Braze and identifies
    which ones should be actively monitored.

    Returns:
        A list of dictionaries, where each dictionary represents a campaign
        that needs to be tracked by the "Brain".
    """
    print("Scout starting: Discovering campaigns to monitor...")
    
    campaigns_to_monitor = []
    page = 1
    
    # The /campaigns/list endpoint is paginated, so we must loop until we get all pages.
    while True:
        print(f"Fetching page {page} of campaigns...")
        params = {"page": page}
        data = braze_api_request("/campaigns/list", params)
        
        # Stop if the API call failed or if there are no more campaigns on the page
        if not data or not data.get("campaigns"):
            break
            
        for campaign in data["campaigns"]:
            campaign_id = campaign.get("id")
            name = campaign.get("name")
            last_edited_str = campaign.get("last_edited")
            
            # --- Rule 1: Find Active, Triggered Campaigns ---
            # These need to be monitored continuously for volume drops.
            if campaign.get("is_active") and not campaign.get("schedule"):
                campaigns_to_monitor.append({
                    "campaign_id": campaign_id,
                    "name": name,
                    "monitor_type": "TRIGGERED",
                    "last_edited": last_edited_str,
                    "scheduled_at": None
                })
                print(f"  -> Found active TRIGGERED campaign: '{name}'")

            # --- Rule 2: Find Upcoming Scheduled Campaigns ---
            # These need to be monitored for successful sends after their scheduled time.
            elif campaign.get("schedule") and campaign['schedule'].get("time"):
                scheduled_time_str = campaign['schedule']['time']
                # Parse the ISO 8601 timestamp from Braze
                scheduled_time = datetime.fromisoformat(scheduled_time_str.replace("Z", "+00:00"))
                
                now_utc = datetime.now(timezone.utc)
                lookahead_limit = now_utc + timedelta(days=CONFIG["SCHEDULED_LOOKAHEAD_DAYS"])

                # Check if the campaign is scheduled to run between now and our lookahead limit
                if now_utc < scheduled_time < lookahead_limit:
                    campaigns_to_monitor.append({
                        "campaign_id": campaign_id,
                        "name": name,
                        "monitor_type": "SCHEDULED",
                        "last_edited": last_edited_str,
                        "scheduled_at": scheduled_time.isoformat()
                    })
                    print(f"  -> Found upcoming SCHEDULED campaign: '{name}' for {scheduled_time_str}")

        page += 1
        
    return campaigns_to_monitor

def main():
    """
    Main function to run the scout and print its findings.
    """
    if CONFIG["BRAZE_API_KEY"] == "YOUR_BRAZE_API_KEY_HERE":
        print("ERROR: Please replace 'YOUR_BRAZE_API_KEY_HERE' in the script or set the BRAZE_API_KEY environment variable.")
        return

    discovered_campaigns = discover_campaigns_to_monitor()
    
    # In a real system, the JSON output below would be passed to your "Brain" (database).
    print("\n" + "="*50)
    print("Full Script Response (JSON format)")
    print(f"This is the raw data output to be sent to the 'Brain'.")
    print("="*50)
    print(json.dumps(discovered_campaigns, indent=2))
    
    print("\n" + "="*50)
    print("Human-Readable Scout Discovery Report")
    print(f"Discovered {len(discovered_campaigns)} total campaigns to monitor.")
    print("="*50)

    # This section provides a more readable summary for manual review.
    for campaign in discovered_campaigns:
        if campaign['monitor_type'] == 'SCHEDULED':
            print(f"- Type: {campaign['monitor_type']}, Name: '{campaign['name']}', Scheduled At: {campaign['scheduled_at']}")
        else:
            print(f"- Type: {campaign['monitor_type']}, Name: '{campaign['name']}'")
            
    print("\nScout finished.")

if __name__ == "__main__":
    main()

