#!/bin/bash

# Configuration
BACKEND_URL="http://localhost:3000"
ENTITY_ID="${1:-ee4f3638-c42d-4a7e-abec-4c3aff068570}"
LIMIT="${2:-}"
TENANT_ID="DEFAULT"

echo "Fetching transaction data for entity: $ENTITY_ID"
if [ -n "$LIMIT" ]; then
    echo "Limit: $LIMIT transactions"
fi
echo ""

# Fetch data
RESPONSE=$(curl -s "${BACKEND_URL}/api/v1/jupyter/proxy/transaction-history/${ENTITY_ID}?tenantId=${TENANT_ID}")

# Check if response is valid JSON
if ! echo "$RESPONSE" | jq empty 2>/dev/null; then
    echo "❌ Failed to fetch transaction data or invalid JSON response"
    echo "$RESPONSE"
    exit 1
fi

# Check for error in response
if echo "$RESPONSE" | jq -e '.statusCode' > /dev/null 2>&1; then
    echo "❌ Error from backend:"
    echo "$RESPONSE" | jq -r '.message'
    exit 1
fi

# Extract summary
echo "================================================================================"
echo "TRANSACTION SUMMARY"
echo "================================================================================"
echo "$RESPONSE" | jq -r '
    .summary | 
    "Total Volume:        \(.totalVolume // 0 | tostring) USD\n" +
    "Total Transactions:  \(.totalTransactions // 0 | tostring)\n" +
    "Alerts Triggered:    \(.alertsTriggered // 0 | tostring)\n" +
    "Investigated:        \(.investigated // 0 | tostring)"
'
echo ""

# Extract timeline
echo "================================================================================"
echo "TRANSACTION TIMELINE"
echo "================================================================================"

if [ -n "$LIMIT" ]; then
    TIMELINE_DATA=$(echo "$RESPONSE" | jq -r ".timeline[:${LIMIT}]")
    TOTAL_COUNT=$(echo "$RESPONSE" | jq -r '.timeline | length')
else
    TIMELINE_DATA=$(echo "$RESPONSE" | jq -r '.timeline')
    TOTAL_COUNT=$(echo "$TIMELINE_DATA" | jq -r 'length')
fi

printf "%-22s %-15s %-20s %-25s\n" "Date" "Type" "Amount" "Counterparty"
echo "--------------------------------------------------------------------------------"

echo "$TIMELINE_DATA" | jq -r '.[] | 
    "\(.date[0:19]) \(.type[0:14] | . + (" " * (14 - length))) \(.currency) \(.amount | tostring | . + (" " * (15 - length))) \(.counterparty[0:24])"
' 2>/dev/null

if [ -n "$LIMIT" ] && [ "$TOTAL_COUNT" -gt "$LIMIT" ]; then
    echo ""
    echo "(Showing $LIMIT of $TOTAL_COUNT transactions)"
else
    echo ""
    echo "(Total: $TOTAL_COUNT transactions)"
fi
echo ""

# Recent Transactions
echo "================================================================================"
echo "RECENT TRANSACTIONS"
echo "================================================================================"

RECENT_DATA=$(echo "$RESPONSE" | jq -r '.recentTransactions')
RECENT_COUNT=$(echo "$RECENT_DATA" | jq -r 'length')

if [ "$RECENT_COUNT" -gt 0 ]; then
    if [ -n "$LIMIT" ]; then
        RECENT_DISPLAY=$(echo "$RECENT_DATA" | jq -r ".[:${LIMIT}]")
    else
        RECENT_DISPLAY="$RECENT_DATA"
    fi
    
    printf "%-22s %-15s %-25s %-20s %-15s\n" "Date" "Type" "Counterparty" "Amount" "Status"
    echo "--------------------------------------------------------------------------------"
    
    echo "$RECENT_DISPLAY" | jq -r '.[] | 
        "\(.date[0:19]) \(.type[0:14] | . + (" " * (14 - length))) \(.counterparty[0:24] | . + (" " * (24 - length))) \(.currency) \(.amount | tostring | . + (" " * (10 - length))) \(if .status then (.status | if type == "array" then join(", ") else tostring end) else "" end)"
    ' 2>/dev/null
    
    if [ -n "$LIMIT" ] && [ "$RECENT_COUNT" -gt "$LIMIT" ]; then
        echo ""
        echo "(Showing $LIMIT of $RECENT_COUNT recent transactions)"
    else
        echo ""
        echo "(Total: $RECENT_COUNT recent transactions)"
    fi
else
    echo "No recent transactions available."
fi
echo ""

# Entity Perspectives
PERSPECTIVES=$(echo "$RESPONSE" | jq -r '.entityPerspectives // []')
PERSPECTIVES_COUNT=$(echo "$PERSPECTIVES" | jq -r 'length')

if [ "$PERSPECTIVES_COUNT" -gt 0 ]; then
    echo "================================================================================"
    echo "ENTITY PERSPECTIVES (Transaction Views)"
    echo "================================================================================"
    echo "When querying by end_to_end_id, the same transaction is stored from"
    echo "4 entity perspectives: Debtor Account, Creditor Account, Debtor"
    echo "Counterparty, and Creditor Counterparty."
    echo ""
    
    printf "%-15s %-15s %-30s %-15s\n" "Type" "Role" "Entity Name" "Amount"
    echo "--------------------------------------------------------------------------------"
    
    echo "$PERSPECTIVES" | jq -r '.[] | 
        "\(.entity_type[0:14] | . + (" " * (14 - length))) \(.entity_role[0:14] | . + (" " * (14 - length))) \(.entity_name[0:29] | . + (" " * (29 - length))) \(.tx_ccy) \(.tx_amount | tostring)"
    ' 2>/dev/null
    echo ""
fi

echo "✅ Transaction data displayed successfully!"
