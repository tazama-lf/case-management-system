# 🎯 Counterparty Network Analysis - Implementation Ready Summary

## ✅ What We Discovered

The lakehouse has **PERFECT** data structures for Counterparty Network Analysis:

### 1. **`tx_network_counterparties_edges`** Table
- **Pre-aggregated counterparty relationships**
- Contains: counterparty_id → counterparty_id connections
- Includes: transaction counts, total amounts, alert flags, timestamps
- **200 edges** connecting **50 unique counterparties**

### 2. **`counterparty_account_links`** Table  
- **Maps entities to their bank accounts**
- Links: counterparty_id ↔ account_id
- Shows which accounts belong to which entities
- **400 links** connecting **100 counterparties** to **100 accounts**

### 3. **Counterparty IDs Are Real!**
- Format: `dbtr_<hash>` (debtor/sender entity) or `cdtr_<hash>` (creditor/receiver entity)
- Example: `dbtr_590333b8f3e040a0af6678f0390f8286` = "Sarah Grant"
- These are ACTUAL entity identifiers, not account IDs

## 📊 Data Flow Understanding

```
Transaction ID (Input)
    ↓
transaction_detail table
    ↓ (extract debtor_account_id, creditor_account_id)
counterparty_account_links table
    ↓ (get counterparty_id for each account)
tx_network_counterparties_edges table
    ↓ (find all edges where counterparty_id is involved)
Network Graph with:
    - Counterparty IDs (nodes)
    - Transaction counts (edge weight)
    - Alert flags (node status)
    - Transaction values (edge labels)
```

## 🎯 What the Endpoint Will Do

**Input:** `GET /api/v1/lakehouse/network-analysis/counterparty/:transactionId?tenantId=DEFAULT`

**Process:**
1. Look up transaction to find involved accounts
2. Get counterparty IDs for those accounts
3. Query all connections for those counterparties
4. Get counterparty names from transaction_detail
5. Calculate frequency/velocity metrics
6. Return network graph data

**Output:**
```json
{
  "transactionId": "12345",
  "centerAccount": "dbtr_590333b8f3e040a0af6678f0390f8286",
  "counterparties": [
    {
      "counterpartyId": "cdtr_bbdc270b8eff4e4991fb2a5288d0334d",
      "counterpartyName": "April Smith",
      "transactionCount": 1,
      "transactionValue": 961.26,
      "averageValue": 961.26,
      "frequency": "LOW",
      "hasAlert": false,
      "lastTransactionDate": "2026-01-13T03:35:16.676000"
    }
    // ... more counterparties
  ],
  "timeRange": "30d",
  "tenantId": "DEFAULT"
}
```

## 🔑 Key Insights

### Difference from Transaction Network:
- **Transaction Network**: Account → Account (bank accounts sending money)
- **Counterparty Network**: Entity → Entity (people/companies transacting)
- One entity can have multiple accounts, network shows entity-level relationships

### Why This Matters for Fraud Detection:
- Identifies shell companies/entities by relationship patterns
- Shows hidden connections between seemingly unrelated entities
- Aggregates activity across all accounts owned by an entity
- Reveals multi-hop relationships (entity A → entity B → entity C)

### Data Quality:
- ✅ Pre-aggregated (fast queries)
- ✅ Real entity IDs (not just names)
- ✅ Alert flags already present
- ✅ Timestamps for temporal analysis
- ✅ Bi-directional relationships (inbound/outbound)

## 🧪 Test Data Available

**Best Test Counterparty:**
- Name: **Sarah Grant**
- ID: `dbtr_590333b8f3e040a0af6678f0390f8286`
- Connections: 4 counterparties
- Total Transactions: 4
- Total Value: $3,845.04
- Status: No alerts

**Test Transaction ID:** 
Need to query: `SELECT transaction_id FROM transaction_detail WHERE debtor_account_id IN (SELECT account_id FROM counterparty_account_links WHERE counterparty_id = 'dbtr_590333b8f3e040a0af6678f0390f8286') LIMIT 1`

## 📋 Implementation Checklist

### Backend (gold-lakehouse.service.ts):
- [ ] Implement `getCounterpartyNetworkData(transactionId, tenantId, timeRange)`
- [ ] Query 1: Get transaction accounts
- [ ] Query 2: Get counterparty IDs from accounts  
- [ ] Query 3: Get network edges from tx_network_counterparties_edges
- [ ] Query 4: Get counterparty names from transaction_detail
- [ ] Calculate velocity metrics (HIGH/MEDIUM/LOW based on tx_per_day)
- [ ] Map to CounterpartyNetworkResponseDto
- [ ] Handle edge cases (no transaction, no connections)

### Controller (gold-lakehouse.controller.ts):
- [ ] Already has skeleton endpoint at line 723-768
- [ ] Just needs to call the service method
- [ ] Add proper error handling
- [ ] Add API documentation annotations

### Frontend (CounterpartyNetworkTab.tsx):
- [ ] Replace mock data with API call
- [ ] Map CounterpartyDto[] to NetworkNodeData[]
- [ ] Create edges from relationship data
- [ ] Handle loading states
- [ ] Show counterparty details on node click

### Testing:
- [ ] Create test script to validate endpoint
- [ ] Test with Sarah Grant's transaction
- [ ] Verify network structure matches expected
- [ ] Test error cases (invalid transaction ID)
- [ ] Verify alert flags display correctly

## 🚀 Ready to Implement?

**Status:** ✅ **FULLY ANALYZED - READY FOR IMPLEMENTATION**

All data structures verified, test data identified, query patterns designed. The lakehouse has everything needed for a complete Counterparty Network Analysis feature.

**Estimated Implementation Time:**
- Service method: 1-2 hours
- Testing: 30 minutes  
- Frontend integration: 1 hour
- **Total: ~3 hours**

**Complexity:** MEDIUM (similar to Transaction Network but with additional joins)

---

For detailed technical analysis, see: [COUNTERPARTY_NETWORK_ANALYSIS.md](./COUNTERPARTY_NETWORK_ANALYSIS.md)
