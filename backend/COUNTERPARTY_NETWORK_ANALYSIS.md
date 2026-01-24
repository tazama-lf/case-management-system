# Counterparty Network Analysis - Understanding & Implementation Plan

## 📋 Overview

Based on the Jira story and prototype screenshots, **Counterparty Network Analysis** is different from Transaction Network Analysis:

### Key Differences:
- **Transaction Network**: Shows Account → Account relationships (money flow between bank accounts)
- **Counterparty Network**: Shows Entity → Entity relationships (people/organizations that transact together)

## 🎯 What the Prototype Shows

From the screenshots, the Counterparty Network visualizes:

### Center Node
- **CP-1111** (Global Trading Corp) - The focal counterparty/entity

### Connected Nodes (1st & 2nd Degree)
1. **CP-4444** (Tech Solutions) - Red/Alert, 1st Degree
   - Transactions: 89
   - Total Value: $1,234,000
   - Frequency: HIGH
   
2. **CP-2222** (ABC Import/Export) - Red/Alert, 1st Degree
   - Transactions: 67
   - Total Value: $892,000
   - Frequency: HIGH

3. **CP-5555** (Offshore Holdings) - Red/Alert, 2nd Degree
   - Transactions: 23
   - Total Value: $345,000
   - Frequency: LOW

4. **CP-3333** (XYZ Logistics) - Blue/Normal, 1st Degree
   - Transactions: 45
   - Total Value: $567,000
   - Frequency: MEDIUM

5. **CP-6666** (Investment Fund A) - Gray/Normal, 2nd Degree
   - Transactions: 34
   - Total Value: $456,000
   - Frequency: MEDIUM

### Relationship Types
- **Center Node**: The focal counterparty being analyzed
- **1st Degree Connection**: Directly transacted with center node
- **2nd Degree Connection**: Transacted with 1st degree counterparties (network expansion)

## 🗄️ Current Data Structure Analysis

### Available in `transaction_detail` Table:
```sql
SELECT 
  transaction_id,
  tx_event_ts,
  debtor_name,           -- Person/entity sending money
  creditor_name,         -- Person/entity receiving money
  debtor_account_id,     -- Account used by debtor
  creditor_account_id,   -- Account used by creditor
  interbank_settlement_amount,
  tenant_id
FROM transaction_detail
```

### ⚠️ The Problem: No Counterparty IDs

**Transaction Network** works because we have:
- `debtor_account_id` → `creditor_account_id` (Account-to-Account relationships)

**Counterparty Network** needs but doesn't have:
- `debtor_counterparty_id` / `debtor_id` (Entity IDs for people/companies)
- `creditor_counterparty_id` / `creditor_id`
- Unique identifiers for each person/organization across all their accounts

### Current Reality:
- We have **names** (`debtor_name`, `creditor_name`) but names can:
  - Have typos
  - Have variations ("John Smith" vs "J. Smith")
  - Not be unique (multiple "John Smith" entities)
- We have **accounts** but one entity can have multiple accounts

## 🤔 Counterparty Network Concept

### What IS a Counterparty?
A **counterparty** is a person or organization (entity) that participates in transactions. They can have:
- Multiple bank accounts
- Multiple transaction roles (sometimes debtor, sometimes creditor)
- Relationships with other entities

### Example:
```
Entity: "Global Trading Corp" (Counterparty ID: CP-1111)
  ├─ Account 1: ACC-001 (Used for domestic transactions)
  ├─ Account 2: ACC-002 (Used for international transactions)
  └─ Account 3: ACC-003 (Used for investment transactions)

When CP-1111 transacts with CP-4444:
  - Could be ACC-001 → ACC-789
  - Could be ACC-002 → ACC-790
  - All count as CP-1111 → CP-4444 relationship
```

## 📊 Data We Need vs Data We Have

### What Counterparty Network REQUIRES:
1. **Counterparty IDs**: Unique identifiers for entities
2. **Counterparty Relationships**: Who transacts with whom at entity level
3. **Aggregated Transaction Stats**: Per counterparty-pair, not per account-pair
4. **Network Degrees**: 1st degree (direct), 2nd degree (friend-of-friend)
5. **Alert Aggregation**: Alerts at entity level, not just account level

### What We HAVE in Lakehouse:
1. ✅ **Transaction Details**: Account-level transaction data
2. ✅ **Names**: `debtor_name`, `creditor_name` (but not unique IDs)
3. ✅ **Account IDs**: `debtor_account_id`, `creditor_account_id`
4. ✅ **Transaction Amounts**: `interbank_settlement_amount`
5. ✅ **Timestamps**: `tx_event_ts`
6. ❌ **Counterparty IDs**: NOT available
7. ❌ **Entity Master Table**: NOT available
8. ❌ **Account-to-Entity Mapping**: NOT available

## 🛠️ Possible Implementation Approaches

### Option 1: Use Names as Proxy Counterparty IDs (Simple, Limited)
```sql
-- Group by debtor_name and creditor_name
SELECT 
  debtor_name as from_counterparty,
  creditor_name as to_counterparty,
  COUNT(*) as transaction_count,
  SUM(interbank_settlement_amount) as total_value
FROM transaction_detail
WHERE tenant_id = 'DEFAULT'
GROUP BY debtor_name, creditor_name
```

**Pros:**
- Can implement immediately with existing data
- No additional tables needed

**Cons:**
- Name variations will create duplicate "counterparties"
- Same person with different name spellings = different nodes
- Not reliable for real fraud detection

### Option 2: Hash/Generate Counterparty IDs from Names (Better)
```sql
-- Create stable IDs from names
SELECT 
  MD5(debtor_name) as from_counterparty_id,
  debtor_name as from_counterparty_name,
  MD5(creditor_name) as to_counterparty_id,
  creditor_name as to_counterparty_name,
  COUNT(*) as transaction_count,
  SUM(interbank_settlement_amount) as total_value
FROM transaction_detail
WHERE tenant_id = 'DEFAULT'
GROUP BY debtor_name, creditor_name
```

**Pros:**
- Creates consistent IDs from names
- Works with existing data structure
- Same name always gets same ID

**Cons:**
- Still vulnerable to name variations
- Cannot link multiple accounts to same entity
- Missing true entity resolution

### Option 3: Check for Entity Master Tables (Ideal, If Available)
Tables that might exist but we haven't checked:
- `counterparty_master` / `entity_master`
- `account_counterparty_mapping`
- `debtor_registry` / `creditor_registry`

**Next Steps:**
1. Query lakehouse to check if these tables exist
2. If they exist, use proper entity IDs
3. If not, use Option 2 as interim solution

## 🎭 Mock Data Pattern from Frontend

Looking at `CounterpartyNetworkTab.tsx`, the frontend expects:
```typescript
{
  nodes: [
    {
      id: "CP-1111",              // Counterparty ID
      label: "Global Trading",    // Counterparty name
      sublabel: "Center Node",    // Relationship type
      status: "alert|normal|flagged",
      isCenter: true
    },
    // ... more nodes
  ],
  edges: [
    {
      source: "CP-1111",
      target: "CP-4444",
      type: "outbound|inbound",
      transactionCount: 89,
      totalValue: 1234000
    }
  ]
}
```

## ✅ DATA EXPLORATION RESULTS

### Tables Confirmed Available:
1. ✅ **`tx_network_counterparties_edges`** - Counterparty-to-counterparty relationships
2. ✅ **`counterparty_account_links`** - Maps counterparties to their bank accounts  
3. ✅ **`transaction_detail`** - Individual transaction records with names

### Data Structure Discovered:

#### `tx_network_counterparties_edges` Schema:
```javascript
{
  from_counterparty_id: "dbtr_590333b8f3e040a0af6678f0390f8286",  // Source entity ID
  to_counterparty_id: "cdtr_bbdc270b8eff4e4991fb2a5288d0334d",    // Target entity ID
  tx_count: 1,                        // Number of transactions between them
  total_amount: 961.26,               // Total transaction value
  currency_hint: "XTS",
  is_alerted_edge: 0,                 // Whether this relationship has alerts
  is_investigated_edge: 0,
  first_event_ts: "2026-01-13...",    // First transaction timestamp
  last_event_ts: "2026-01-13...",     // Last transaction timestamp
  active_window_sec: 0,
  tx_per_day: 1,
  tenant_id: "DEFAULT"
}
```

**Statistics:**
- Total edges: **200**
- Unique "from" counterparties: **50**
- Unique "to" counterparties: **50**

#### `counterparty_account_links` Schema:
```javascript
{
  counterparty_id: "dbtr_b22cd4cd61b9407d825f40be29bb5fe9",  // Entity ID
  account_id: "dbtrAcct_de52b2c4041c4a03a73a92cfb0b8cf35",   // Bank account ID
  tx_count: 1,                         // Transactions using this account
  total_amount: 829.58,
  is_alerted_edge: 0,
  is_investigated_edge: 0,
  first_event_ts: "2026-01-13...",
  last_event_ts: "2026-01-13...",
  tenant_id: "DEFAULT"
}
```

**Statistics:**
- Total links: **400**
- Unique counterparties: **100**
- Unique accounts: **100**

### Test Counterparty Identified:

**Counterparty:** Sarah Grant  
**ID:** `dbtr_590333b8f3e040a0af6678f0390f8286`  
**Connections:** 4 counterparties  
**Total Transactions:** 4  
**Total Value:** $3,845.04

**Sample Connection:**
- To: `cdtr_bbdc270b8eff4e4991fb2a5288d0334d`
- Transactions: 1
- Value: $961.26
- Alert Status: No alerts

### Key Insights:

1. **Counterparty IDs are prefixed:**
   - `dbtr_*` = Debtor/sender entity IDs
   - `cdtr_*` = Creditor/receiver entity IDs

2. **Account IDs are also prefixed:**
   - `dbtrAcct_*` = Debtor accounts
   - `cdtrAcct_*` = Creditor accounts

3. **Entity Names available via JOIN:**
   ```sql
   -- Get counterparty name by joining with transaction_detail
   SELECT DISTINCT debtor_name
   FROM transaction_detail
   WHERE debtor_account_id IN (
     SELECT account_id 
     FROM counterparty_account_links 
     WHERE counterparty_id = 'dbtr_590333b8f3e040a0af6678f0390f8286'
   )
   ```

4. **Network Analysis is Pre-computed:**
   - The lakehouse already maintains aggregated edge data
   - No need to compute on-the-fly from transaction_detail
   - Much faster query performance

## 📝 Recommended Analysis Steps

### Step 1: Check Available Tables
```sql
-- List all tables in lakehouse
SHOW TABLES;

-- Or search for entity/counterparty related tables
SHOW TABLES LIKE '%entity%';
SHOW TABLES LIKE '%counterparty%';
SHOW TABLES LIKE '%party%';
```

### Step 2: Check transaction_detail Fields
```sql
DESCRIBE transaction_detail;
-- Look for hidden entity ID fields we might have missed
```

### Step 3: Analyze Name Patterns
```sql
-- Check how many unique names vs unique accounts
SELECT 
  COUNT(DISTINCT debtor_name) as unique_debtor_names,
  COUNT(DISTINCT debtor_account_id) as unique_debtor_accounts,
  COUNT(DISTINCT creditor_name) as unique_creditor_names,
  COUNT(DISTINCT creditor_account_id) as unique_creditor_accounts
FROM transaction_detail;
```

### Step 4: Build Counterparty Network Query (Using Names)
```sql
-- Find all counterparties for a given entity
WITH focal_entity AS (
  SELECT 'Sarah Grant' as entity_name  -- Example from test data
),
direct_connections AS (
  -- Outbound: focal entity as debtor
  SELECT 
    debtor_name as from_entity,
    creditor_name as to_entity,
    COUNT(*) as tx_count,
    SUM(interbank_settlement_amount) as total_amount,
    MAX(tx_event_ts) as last_tx_date,
    1 as degree
  FROM transaction_detail
  WHERE debtor_name = (SELECT entity_name FROM focal_entity)
    AND tenant_id = 'DEFAULT'
  GROUP BY debtor_name, creditor_name
  
  UNION ALL
  
  -- Inbound: focal entity as creditor
  SELECT 
    debtor_name as from_entity,
    creditor_name as to_entity,
    COUNT(*) as tx_count,
    SUM(interbank_settlement_amount) as total_amount,
    MAX(tx_event_ts) as last_tx_date,
    1 as degree
  FROM transaction_detail
  WHERE creditor_name = (SELECT entity_name FROM focal_entity)
    AND tenant_id = 'DEFAULT'
  GROUP BY debtor_name, creditor_name
)
SELECT * FROM direct_connections;
```

## 🎯 Implementation Plan (READY TO IMPLEMENT)

### Input Parameter Options:

Based on the Jira story screenshot "**User Story: Counterparty Network Analysis**", the input should be:
- **Transaction ID** (as shown in prototype context)
- From the transaction, extract involved counterparty IDs
- Build network around those counterparties

### SQL Query Design:

```sql
-- Step 1: Get transaction to find involved counterparties
SELECT 
  debtor_account_id,
  creditor_account_id
FROM transaction_detail
WHERE transaction_id = '<transactionId>'
  AND tenant_id = 'DEFAULT'

-- Step 2: Get counterparty IDs from accounts
SELECT 
  counterparty_id
FROM counterparty_account_links
WHERE account_id IN ('<debtor_account_id>', '<creditor_account_id>')
  AND tenant_id = 'DEFAULT'

-- Step 3: Get 1st degree network (direct connections)
SELECT 
  from_counterparty_id,
  to_counterparty_id,
  tx_count,
  total_amount,
  is_alerted_edge,
  first_event_ts,
  last_event_ts
FROM tx_network_counterparties_edges
WHERE (from_counterparty_id IN ('<counterparty_ids>') 
   OR to_counterparty_id IN ('<counterparty_ids>'))
  AND tenant_id = 'DEFAULT'

-- Step 4: Get counterparty names from transaction_detail
SELECT DISTINCT 
  debtor_account_id,
  debtor_name
FROM transaction_detail
WHERE debtor_account_id IN (
  SELECT account_id 
  FROM counterparty_account_links 
  WHERE counterparty_id = '<id>'
)
UNION
SELECT DISTINCT 
  creditor_account_id,
  creditor_name
FROM transaction_detail
WHERE creditor_account_id IN (
  SELECT account_id 
  FROM counterparty_account_links 
  WHERE counterparty_id = '<id>'
)

-- Step 5: Optional - Get 2nd degree connections (if needed)
-- Find counterparties connected to 1st degree counterparties
```

### DTO Structure (Already Exists):

```typescript
CounterpartyNetworkResponseDto {
  transactionId: string           // Input transaction ID
  centerAccount: string           // Center counterparty ID (from transaction)
  counterparties: CounterpartyDto[] // Connected entities
  timeRange: string               // Time filter used
  tenantId: string
}

CounterpartyDto {
  counterpartyId: string          // Entity ID (dbtr_* or cdtr_*)
  counterpartyName: string        // Entity name (from transaction_detail)
  transactionCount: number        // tx_count from edges table
  transactionValue: number        // total_amount from edges table
  averageValue: number            // total_amount / tx_count
  frequency: 'HIGH|MEDIUM|LOW'    // Based on tx_per_day or calculated
  hasAlert: boolean               // is_alerted_edge flag
  lastTransactionDate: string     // last_event_ts
}
```

### Implementation Steps:

1. **Update `getCounterpartyNetworkData()` method** in `gold-lakehouse.service.ts`:
   - Input: `transactionId`, `tenantId`, `timeRange`
   - Query transaction_detail to get involved accounts
   - Query counterparty_account_links to get counterparty IDs
   - Query tx_network_counterparties_edges for network
   - Query transaction_detail to get counterparty names
   - Map to CounterpartyNetworkResponseDto

2. **Controller endpoint** already exists (skeleton):
   - `GET /api/v1/lakehouse/network-analysis/counterparty/:transactionId`
   - Add query params: `?tenantId=DEFAULT&timeRange=30d`

3. **Frontend integration**:
   - `CounterpartyNetworkTab.tsx` already has mock data structure
   - Replace mock with actual API call
   - Map response to NetworkNodeData and edges

### Test Data:

**Transaction ID to use:** Find from transaction_detail where counterparty `dbtr_590333b8f3e040a0af6678f0390f8286` (Sarah Grant) is involved

**Expected Result:**
- Center: Sarah Grant (dbtr_590333b8f3e040a0af6678f0390f8286)
- 4 connected counterparties
- Total value: $3,845.04
- No alerts (is_alerted_edge = 0)

### Key Differences from Transaction Network:

| Aspect | Transaction Network | Counterparty Network |
|--------|-------------------|---------------------|
| Input | Account ID | Transaction ID |
| Focus | Account → Account | Entity → Entity |
| Data Source | transaction_detail | tx_network_counterparties_edges |
| Aggregation | Group transactions | Pre-aggregated edges |
| Name Resolution | Direct from transaction | Join via counterparty_account_links |

## 🔍 Questions ANSWERED

1. **Does the lakehouse have entity/counterparty ID fields?** ✅ YES - `counterparty_id` in multiple tables
2. **What should be the input parameter?** ✅ **Transaction ID** (as per Jira story context)
3. **How do we identify unique entities?** ✅ Pre-generated counterparty IDs (dbtr_*, cdtr_*)
4. **How to get counterparty names?** ✅ Join with transaction_detail via counterparty_account_links
5. **Is data pre-aggregated?** ✅ YES - tx_network_counterparties_edges has aggregated stats
6. **How to handle 2nd degree?** 🔄 Optional - query edges where from_counterparty_id IN (1st_degree_ids)

## 🎯 Next Actions (DO NOT IMPLEMENT YET)

1. **Verify Data Availability**:
   - Run table discovery queries
   - Check for entity/counterparty ID fields
   - Understand name uniqueness patterns

2. **Design SQL Query**:
   - Build counterparty network query using available data
   - Handle 1st and 2nd degree connections
   - Aggregate transaction stats at entity level

3. **Define DTO Adjustments**:
   - `CounterpartyNetworkResponseDto` already exists
   - May need to add degree/relationship fields
   - Add network visualization metadata

4. **Implementation Plan**:
   - Create `getCounterpartyNetworkData()` method in service
   - Add controller endpoint (already exists skeleton)
   - Map lakehouse results to DTO format
   - Handle edge cases (no connections, circular relationships)

## ⚠️ Key Challenges to Address

1. **Entity Resolution**: How to uniquely identify counterparties without entity IDs
2. **Name Normalization**: Handling name variations and typos
3. **Multi-Account Entities**: Recognizing when multiple accounts belong to same entity
4. **2nd Degree Connections**: Computing friend-of-friend relationships efficiently
5. **Performance**: Network queries can be computationally expensive
6. **Alert Aggregation**: Rolling up account-level alerts to entity level

## 🔍 Questions to Answer Before Implementation

1. **Does the lakehouse have entity/counterparty ID fields we haven't discovered?**
2. **What is the expected input?** Transaction ID, Account ID, or Counterparty Name?
3. **How deep should network go?** 1st degree only, or include 2nd degree?
4. **How to handle name variations?** Exact match or fuzzy matching?
5. **What about shared accounts?** (Joint accounts, corporate accounts)
6. **Performance requirements?** Real-time or can be cached?

---

**Status**: Analysis phase - awaiting data verification before implementation
