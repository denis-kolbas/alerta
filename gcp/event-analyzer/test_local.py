#!/usr/bin/env python3
"""
Local testing script for event-analyzer with detailed logging
Usage: python3 test_local.py <brand_name>
Example: python3 test_local.py Bark
"""

import sys
import os
from datetime import datetime, timezone, timedelta
from statistics import mean, stdev
import psycopg2
from psycopg2.extras import Json
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich import print as rprint

console = Console()

# --- Config ---
ANALYSIS_WINDOW_HOURS = 168  # 7 days
MIN_DATA_POINTS = 24

# --- Database ---
def get_db_connection():
    db_uri = os.environ.get("SUPABASE_CONNECTION_URI")
    if not db_uri:
        db_uri = input("Enter SUPABASE_CONNECTION_URI: ")
    return psycopg2.connect(db_uri)

def get_event_data(conn, brand_name, event_name, hours=ANALYSIS_WINDOW_HOURS):
    """Fetch event data for analysis"""
    query = """
        SELECT timestamp, count
        FROM event_data
        WHERE brand = %s 
          AND event_name = %s 
          AND timestamp >= NOW() - INTERVAL '%s hours'
        ORDER BY timestamp ASC;
    """
    with conn.cursor() as cur:
        cur.execute(query, (brand_name, event_name, hours))
        return cur.fetchall()

def get_all_events_for_brand(conn, brand_name):
    """Get list of all events for a brand"""
    query = """
        SELECT DISTINCT event_name
        FROM event_data
        WHERE brand = %s
        ORDER BY event_name;
    """
    with conn.cursor() as cur:
        cur.execute(query, (brand_name,))
        return [row[0] for row in cur.fetchall()]

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
        "total_data_points": len(data_points),
        "min_count": min(counts),
        "max_count": max(counts)
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
def check_silence_detection(brand_name, event_name, data_points, baseline):
    """Rule 1: Detect when event is silent longer than normal"""
    current_silence = count_current_silence(data_points)
    max_silence = baseline["max_silence_hours"]
    
    console.print(f"\n  [cyan]Silence Check:[/cyan]")
    console.print(f"    Current silence: {current_silence}h")
    console.print(f"    Historical max: {max_silence}h")
    console.print(f"    Threshold (1.5x): {max_silence * 1.5}h")
    
    if current_silence == 0:
        console.print(f"    [green]✓ Event is active[/green]")
        return None
    
    if current_silence <= max_silence * 1.5:
        console.print(f"    [green]✓ Within normal range[/green]")
        return None
    
    multiplier = current_silence / max_silence if max_silence > 0 else 999
    severity = "critical" if multiplier >= 2.0 else "warning"
    
    console.print(f"    [red]✗ ALERT: Silence detected![/red]")
    console.print(f"    Multiplier: {multiplier:.2f}x")
    console.print(f"    Severity: {severity}")
    
    return {
        "rule": "silence_detection",
        "severity": severity,
        "message": f"{event_name} has been silent for {current_silence} hours (typical max: {max_silence}h)",
        "metadata": {
            "current_silence_hours": current_silence,
            "baseline_max_silence_hours": max_silence,
            "multiplier": round(multiplier, 2)
        }
    }

def check_spike_detection(brand_name, event_name, data_points, baseline):
    """Rule 2: Detect when event count spikes above normal"""
    current_count = data_points[-1][1]
    threshold = baseline["avg_count"] + (3 * baseline["stddev_count"])
    
    console.print(f"\n  [cyan]Spike Check:[/cyan]")
    console.print(f"    Current count: {current_count}")
    console.print(f"    Average: {baseline['avg_count']}")
    console.print(f"    Std dev: {baseline['stddev_count']}")
    console.print(f"    Threshold (avg + 3σ): {threshold:.2f}")
    
    if current_count <= threshold:
        console.print(f"    [green]✓ Within normal range[/green]")
        return None
    
    stddev_multiplier = (current_count - baseline["avg_count"]) / baseline["stddev_count"] if baseline["stddev_count"] > 0 else 999
    
    console.print(f"    [red]✗ ALERT: Spike detected![/red]")
    console.print(f"    Standard deviations above: {stddev_multiplier:.2f}σ")
    
    return {
        "rule": "spike_detection",
        "severity": "warning",
        "message": f"{event_name} spike detected: {current_count} events (normal: {baseline['avg_count']:.0f})",
        "metadata": {
            "current_count": current_count,
            "baseline_avg": baseline["avg_count"],
            "baseline_stddev": baseline["stddev_count"],
            "threshold": round(threshold, 2),
            "stddev_multiplier": round(stddev_multiplier, 2)
        }
    }

def check_drop_detection(brand_name, event_name, data_points, baseline):
    """Rule 3: Detect when event count drops below normal (but not zero)"""
    current_count = data_points[-1][1]
    threshold = baseline["avg_count"] - (3 * baseline["stddev_count"])
    
    console.print(f"\n  [cyan]Drop Check:[/cyan]")
    console.print(f"    Current count: {current_count}")
    console.print(f"    Average: {baseline['avg_count']}")
    console.print(f"    Std dev: {baseline['stddev_count']}")
    console.print(f"    Threshold (avg - 3σ): {threshold:.2f}")
    
    if current_count == 0:
        console.print(f"    [yellow]⊘ Skipped (zero count - handled by silence detection)[/yellow]")
        return None
    
    if current_count >= threshold:
        console.print(f"    [green]✓ Within normal range[/green]")
        return None
    
    stddev_multiplier = (baseline["avg_count"] - current_count) / baseline["stddev_count"] if baseline["stddev_count"] > 0 else 999
    
    console.print(f"    [red]✗ ALERT: Drop detected![/red]")
    console.print(f"    Standard deviations below: {stddev_multiplier:.2f}σ")
    
    return {
        "rule": "drop_detection",
        "severity": "warning",
        "message": f"{event_name} drop detected: {current_count} events (normal: {baseline['avg_count']:.0f})",
        "metadata": {
            "current_count": current_count,
            "baseline_avg": baseline["avg_count"],
            "baseline_stddev": baseline["stddev_count"],
            "threshold": round(threshold, 2),
            "stddev_multiplier": round(stddev_multiplier, 2)
        }
    }

# --- Main ---
def main():
    if len(sys.argv) < 2:
        console.print("[red]Usage: python3 test_local.py <brand_name>[/red]")
        console.print("Example: python3 test_local.py Bark")
        sys.exit(1)
    
    brand_name = sys.argv[1]
    
    console.print(Panel.fit(
        f"[bold cyan]Event Analyzer - Local Test[/bold cyan]\n"
        f"Brand: [yellow]{brand_name}[/yellow]\n"
        f"Analysis Window: {ANALYSIS_WINDOW_HOURS} hours ({ANALYSIS_WINDOW_HOURS//24} days)\n"
        f"Min Data Points: {MIN_DATA_POINTS}",
        border_style="cyan"
    ))
    
    try:
        conn = get_db_connection()
        console.print("[green]✓ Connected to database[/green]\n")
        
        # Get all events for brand
        events = get_all_events_for_brand(conn, brand_name)
        console.print(f"Found [yellow]{len(events)}[/yellow] events for {brand_name}\n")
        
        if not events:
            console.print("[red]No events found for this brand![/red]")
            return
        
        alerts_found = []
        events_analyzed = 0
        events_skipped = 0
        
        for i, event_name in enumerate(events, 1):
            console.print(f"\n{'='*80}")
            console.print(f"[bold]Event {i}/{len(events)}: {event_name}[/bold]")
            console.print(f"{'='*80}")
            
            # Fetch data
            data_points = get_event_data(conn, brand_name, event_name)
            console.print(f"Fetched [cyan]{len(data_points)}[/cyan] data points")
            
            if len(data_points) < MIN_DATA_POINTS:
                console.print(f"[yellow]⊘ Skipped: Insufficient data (need {MIN_DATA_POINTS}, have {len(data_points)})[/yellow]")
                events_skipped += 1
                continue
            
            # Show recent data
            console.print(f"\n[bold]Recent Data (last 5 hours):[/bold]")
            table = Table(show_header=True, header_style="bold magenta")
            table.add_column("Timestamp", style="dim")
            table.add_column("Count", justify="right")
            for timestamp, count in data_points[-5:]:
                table.add_row(str(timestamp), str(count))
            console.print(table)
            
            # Calculate baseline
            baseline = calculate_baseline(data_points)
            if not baseline:
                console.print(f"[red]✗ Failed to calculate baseline[/red]")
                events_skipped += 1
                continue
            
            console.print(f"\n[bold]Baseline Statistics:[/bold]")
            baseline_table = Table(show_header=False)
            baseline_table.add_column("Metric", style="cyan")
            baseline_table.add_column("Value", justify="right", style="yellow")
            baseline_table.add_row("Average Count", f"{baseline['avg_count']}")
            baseline_table.add_row("Std Deviation", f"{baseline['stddev_count']}")
            baseline_table.add_row("Min Count", f"{baseline['min_count']}")
            baseline_table.add_row("Max Count", f"{baseline['max_count']}")
            baseline_table.add_row("Max Silence", f"{baseline['max_silence_hours']}h")
            baseline_table.add_row("Avg Silence", f"{baseline['avg_silence_hours']}h")
            baseline_table.add_row("Data Points", f"{baseline['total_data_points']}")
            console.print(baseline_table)
            
            # Run rules
            console.print(f"\n[bold]Running Alert Rules:[/bold]")
            result1 = check_silence_detection(brand_name, event_name, data_points, baseline)
            result2 = check_spike_detection(brand_name, event_name, data_points, baseline)
            result3 = check_drop_detection(brand_name, event_name, data_points, baseline)
            
            if result1 or result2 or result3:
                for result in [result1, result2, result3]:
                    if result:
                        alerts_found.append({
                            "event": event_name,
                            **result
                        })
            
            events_analyzed += 1
        
        # Summary
        console.print(f"\n{'='*80}")
        console.print(Panel.fit(
            f"[bold green]Analysis Complete[/bold green]\n\n"
            f"Events Analyzed: [cyan]{events_analyzed}[/cyan]\n"
            f"Events Skipped: [yellow]{events_skipped}[/yellow]\n"
            f"Alerts Found: [red]{len(alerts_found)}[/red]",
            border_style="green"
        ))
        
        if alerts_found:
            console.print(f"\n[bold red]Alerts That Would Be Created:[/bold red]\n")
            for alert in alerts_found:
                console.print(Panel(
                    f"[bold]{alert['event']}[/bold]\n"
                    f"Rule: {alert['rule']}\n"
                    f"Severity: {alert['severity']}\n"
                    f"Message: {alert['message']}\n"
                    f"Metadata: {alert['metadata']}",
                    border_style="red"
                ))
        
    except Exception as e:
        console.print(f"[red]Error: {e}[/red]")
        import traceback
        console.print(traceback.format_exc())
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    main()
