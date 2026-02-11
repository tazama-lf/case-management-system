#!/bin/bash

# Demo script showing transaction data format with 4 sample transactions
# Usage: ./show_transactions_demo.sh [number_of_rows]

ROW_COUNT="${1:-4}"

echo "================================================================================"
echo "TRANSACTION SUMMARY"
echo "================================================================================"
echo "Total Volume:        USD 45,750.00"
echo "Total Transactions:  $ROW_COUNT"
echo "Alerts Triggered:    2"
echo "Investigated:        1"
echo ""

echo "================================================================================"
echo "TRANSACTION TIMELINE"
echo "================================================================================"
printf "%-22s %-15s %-20s %-25s\n" "Date" "Type" "Amount" "Counterparty"
echo "--------------------------------------------------------------------------------"

# Sample transactions based on row count
TRANSACTIONS=(
    "2026-02-10 14:30:22    Payment         USD 12,500.00        Acme Corporation"
    "🚨2026-02-09 09:15:45    Transfer        USD 25,000.00        Global Trade Ltd"
    "2026-02-08 16:45:12    Payment         USD 3,250.00         Tech Solutions Inc"
    "🚨2026-02-07 11:20:33    Wire Transfer   USD 5,000.00         International Bank"
    "2026-02-06 13:55:18    Payment         USD 1,500.00         Retail Partners"
    "2026-02-05 10:30:45    Transfer        USD 8,750.00         Manufacturing Co"
    "2026-02-04 15:12:22    Payment         USD 2,200.00         Service Provider"
    "2026-02-03 08:45:55    Wire Transfer   USD 15,000.00        Investment Group"
)

# Display only requested number of rows
for i in $(seq 0 $((ROW_COUNT - 1))); do
    if [ $i -lt ${#TRANSACTIONS[@]} ]; then
        echo "${TRANSACTIONS[$i]}"
    fi
done

echo ""
echo "(Total: $ROW_COUNT transactions)"
echo ""

echo "================================================================================"
echo "RECENT TRANSACTIONS"
echo "================================================================================"
printf "%-22s %-15s %-25s %-20s %-15s\n" "Date" "Type" "Counterparty" "Amount" "Status"
echo "--------------------------------------------------------------------------------"

# Recent transactions with status
RECENT=(
    "2026-02-10 14:30:22    Payment         Acme Corporation          USD 12,500.00        Cleared"
    "2026-02-09 09:15:45    Transfer        Global Trade Ltd          USD 25,000.00        Alert"
    "2026-02-08 16:45:12    Payment         Tech Solutions Inc        USD 3,250.00         Cleared"
    "2026-02-07 11:20:33    Wire Transfer   International Bank        USD 5,000.00         Alert, Inv."
    "2026-02-06 13:55:18    Payment         Retail Partners           USD 1,500.00         Cleared"
    "2026-02-05 10:30:45    Transfer        Manufacturing Co          USD 8,750.00         Cleared"
    "2026-02-04 15:12:22    Payment         Service Provider          USD 2,200.00         Cleared"
    "2026-02-03 08:45:55    Wire Transfer   Investment Group          USD 15,000.00        Cleared"
)

for i in $(seq 0 $((ROW_COUNT - 1))); do
    if [ $i -lt ${#RECENT[@]} ]; then
        echo "${RECENT[$i]}"
    fi
done

echo ""
echo "(Showing $ROW_COUNT of $ROW_COUNT recent transactions)"
echo ""

echo "================================================================================"
echo "ENTITY PERSPECTIVES (Transaction Views)"
echo "================================================================================"
echo "When querying by end_to_end_id, the same transaction is stored from"
echo "$ROW_COUNT entity perspectives: Debtor Account, Creditor Account, Debtor"
echo "Counterparty, and Creditor Counterparty."
echo ""

printf "%-15s %-15s %-30s %-15s\n" "Type" "Role" "Entity Name" "Amount"
echo "--------------------------------------------------------------------------------"

PERSPECTIVES=(
    "Account         Debtor          John Doe Checking Account      USD 25,000.00"
    "Account         Creditor        Global Trade Business Acct     USD 25,000.00"
    "Counterparty    Debtor          John Doe                       USD 25,000.00"
    "Counterparty    Creditor        Global Trade Ltd               USD 25,000.00"
)

for i in $(seq 0 $((ROW_COUNT - 1))); do
    if [ $i -lt ${#PERSPECTIVES[@]} ]; then
        echo "${PERSPECTIVES[$i]}"
    fi
done

echo ""

echo "✅ Transaction data displayed successfully!"
echo ""
echo "NOTE: This is demo data showing the expected format."
echo "      Row count parameter: $ROW_COUNT"
