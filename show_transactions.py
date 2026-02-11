#!/usr/bin/env python3
"""
Simple script to fetch and display all available transactions in summary and timeline format.
Shows exactly N transactions if available (e.g., if row count is 4, shows 4).
"""

import requests
import json
import sys
from datetime import datetime
from typing import Dict, List, Any

# Configuration
BACKEND_URL = "http://localhost:3000"
DEFAULT_ENTITY_ID = "ee4f3638-c42d-4a7e-abec-4c3aff068570"
TENANT_ID = "DEFAULT"

def fetch_transaction_history(entity_id: str, tenant_id: str = TENANT_ID) -> Dict[str, Any]:
    """Fetch transaction history from backend."""
    url = f"{BACKEND_URL}/api/v1/jupyter/proxy/transaction-history/{entity_id}"
    params = {'tenantId': tenant_id}
    
    try:
        response = requests.get(url, params=params, timeout=10)
        if response.status_code == 200:
            return response.json()
        else:
            print(f"Error: {response.status_code} - {response.text}", file=sys.stderr)
            return None
    except Exception as e:
        print(f"Error fetching data: {e}", file=sys.stderr)
        return None

def format_currency(amount: float, currency: str = "USD") -> str:
    """Format currency with proper formatting."""
    return f"{currency} {amount:,.2f}"

def format_datetime(dt_str: str) -> str:
    """Format datetime string."""
    try:
        dt = datetime.fromisoformat(dt_str.replace('Z', '+00:00'))
        return dt.strftime('%Y-%m-%d %H:%M:%S')
    except:
        return dt_str

def print_summary(data: Dict[str, Any]):
    """Print summary metrics."""
    summary = data.get('summary', {})
    
    print("=" * 80)
    print("TRANSACTION SUMMARY")
    print("=" * 80)
    print(f"Total Volume:        {format_currency(summary.get('totalVolume', 0))}")
    print(f"Total Transactions:  {summary.get('totalTransactions', 0):,}")
    print(f"Alerts Triggered:    {summary.get('alertsTriggered', 0)}")
    print(f"Investigated:        {summary.get('investigated', 0)}")
    print()

def print_timeline(timeline: List[Dict[str, Any]], limit: int = None):
    """Print transaction timeline."""
    print("=" * 80)
    print("TRANSACTION TIMELINE")
    print("=" * 80)
    
    if not timeline:
        print("No timeline data available.")
        return
    
    # Apply limit if specified
    display_timeline = timeline[:limit] if limit else timeline
    
    # Header
    print(f"{'Date':<20} {'Type':<15} {'Amount':<20} {'Counterparty':<25}")
    print("-" * 80)
    
    # Rows
    for tx in display_timeline:
        date = format_datetime(tx.get('date', ''))
        tx_type = tx.get('type', 'N/A')[:14]
        amount = format_currency(tx.get('amount', 0), tx.get('currency', 'USD'))
        counterparty = tx.get('counterparty', 'N/A')[:24]
        
        # Add alert indicator
        alert_marker = "🚨" if tx.get('isAlerted', False) else "  "
        
        print(f"{alert_marker}{date:<20} {tx_type:<15} {amount:<20} {counterparty:<25}")
    
    total_count = len(timeline)
    if limit and total_count > limit:
        print(f"\n(Showing {limit} of {total_count} transactions)")
    else:
        print(f"\n(Total: {total_count} transactions)")
    print()

def print_entity_perspectives(data: Dict[str, Any]):
    """Print entity perspectives if available."""
    perspectives = data.get('entityPerspectives', [])
    
    if not perspectives:
        return
    
    print("=" * 80)
    print("ENTITY PERSPECTIVES (Transaction Views)")
    print("=" * 80)
    print("When querying by end_to_end_id, the same transaction is stored from")
    print("4 entity perspectives: Debtor Account, Creditor Account, Debtor")
    print("Counterparty, and Creditor Counterparty.")
    print()
    
    # Header
    print(f"{'Type':<15} {'Role':<15} {'Entity Name':<30} {'Amount':<15}")
    print("-" * 80)
    
    # Rows
    for p in perspectives:
        entity_type = p.get('entity_type', 'N/A')[:14]
        entity_role = p.get('entity_role', 'N/A')[:14]
        entity_name = p.get('entity_name', 'N/A')[:29]
        amount = format_currency(p.get('tx_amount', 0), p.get('tx_ccy', 'USD'))
        
        print(f"{entity_type:<15} {entity_role:<15} {entity_name:<30} {amount:<15}")
    
    print()

def print_recent_transactions(data: Dict[str, Any], limit: int = None):
    """Print recent transactions table."""
    recent = data.get('recentTransactions', [])
    
    if not recent:
        return
    
    print("=" * 80)
    print("RECENT TRANSACTIONS")
    print("=" * 80)
    
    # Apply limit if specified
    display_recent = recent[:limit] if limit else recent
    
    # Header
    print(f"{'Date':<20} {'Type':<15} {'Counterparty':<25} {'Amount':<20} {'Status':<15}")
    print("-" * 80)
    
    # Rows
    for tx in display_recent:
        date = format_datetime(tx.get('date', ''))
        tx_type = tx.get('type', 'N/A')[:14]
        counterparty = tx.get('counterparty', 'N/A')[:24]
        amount = format_currency(tx.get('amount', 0), tx.get('currency', 'USD'))
        
        # Format status
        status = tx.get('status', '')
        if isinstance(status, list):
            status = ', '.join(str(s) for s in status)
        status = str(status)[:14]
        
        print(f"{date:<20} {tx_type:<15} {counterparty:<25} {amount:<20} {status:<15}")
    
    total_count = len(recent)
    if limit and total_count > limit:
        print(f"\n(Showing {limit} of {total_count} recent transactions)")
    else:
        print(f"\n(Total: {total_count} recent transactions)")
    print()

def main():
    """Main function."""
    # Parse command line arguments
    entity_id = DEFAULT_ENTITY_ID
    limit = None
    
    if len(sys.argv) > 1:
        entity_id = sys.argv[1]
    
    if len(sys.argv) > 2:
        try:
            limit = int(sys.argv[2])
        except ValueError:
            print(f"Warning: Invalid limit '{sys.argv[2]}', showing all transactions", file=sys.stderr)
    
    print(f"\nFetching transaction data for entity: {entity_id}")
    if limit:
        print(f"Limit: {limit} transactions\n")
    
    # Fetch data
    data = fetch_transaction_history(entity_id)
    
    if not data:
        print("\n❌ Failed to fetch transaction data.")
        print("\nTroubleshooting:")
        print("1. Make sure the backend is running at http://localhost:3000")
        print("2. Check that the Gold Lakehouse service is available")
        print("3. Verify the entity ID exists in the database")
        sys.exit(1)
    
    # Display results
    print_summary(data)
    print_timeline(data.get('timeline', []), limit=limit)
    print_recent_transactions(data, limit=limit)
    print_entity_perspectives(data)
    
    print("✅ Transaction data displayed successfully!")

if __name__ == "__main__":
    main()
