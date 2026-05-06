# DWH and Alert Payload Integration - Test Data

## 📋 Summary

Updated DWH seed data and created 10 test alert payloads to match NATS structure with DWH transactions.

---

## ✅ Changes Made

### 1. **Updated DWH Seed Data** (`setup-five-customers.sql`)

**Account IDs Changed:**
- `ACC-001` → `fsp001` (John Smith)
- `ACC-002` → `fsp002` (Jane Doe)
- `ACC-003` → `fsp003` (Robert Johnson)
- `ACC-004` → `fsp004` (Sarah Williams)
- `ACC-005` → `fsp005` (Michael Brown)

**Transaction Type Updated:**
- All transactions now use `tx_tp = 'pacs.002.001.12'` (instead of "Payment", "Transfer", etc.)
- Transaction status: `tx_sts = 'ACCC'` (instead of "Completed")

**Result:** FSP IDs in NATS payloads now match account IDs in DWH!

---

### 2. **Created 10 Test Alert Payloads** (`test-alerts/alert-payloads.json`)

#### **5 NALT Alerts (No Alert - Below Threshold)**

| ID | Customer | Transaction ID | Amount | FSP | Status | Confidence |
|----|----------|----------------|--------|-----|--------|------------|
| 1 | John Smith | TXN-001-01 | $500 | fsp001 | NALT | 75.0% |
| 2 | Jane Doe | TXN-002-01 | $2,500 | fsp002 | NALT | 82.5% |
| 3 | Robert Johnson | TXN-003-01 | $15,000 | fsp003 | NALT | 88.0% |
| 4 | Sarah Williams | TXN-004-02 | $1,800 | fsp004 | NALT | 79.0% |
| 5 | Michael Brown | TXN-005-02 | $4,500 | fsp005 | NALT | 81.5% |

**NALT alerts:**
- Score < 200 (below alert threshold)
- Will NOT create cases
- Stored in alerts table only

#### **5 ALRT Alerts (Alert - Above Threshold)**

| ID | Customer | Transaction ID | Amount | FSP | Status | Confidence | Priority |
|----|----------|----------------|--------|-----|--------|------------|----------|
| 6 | John Smith | TXN-001-02 | $1,200 | fsp001 | ALRT | 92.0% | URGENT |
| 7 | Jane Doe | TXN-002-02 | $800 | fsp002 | ALRT | 95.5% | CRITICAL |
| 8 | Robert Johnson | TXN-003-02 | $3,200 | fsp003 | ALRT | 90.0% | URGENT |
| 9 | Sarah Williams | TXN-004-03 | $950 | fsp004 | ALRT | 87.5% | URGENT |
| 10 | Michael Brown | TXN-005-01 | $25,000 | fsp005 | ALRT | 97.0% | CRITICAL |

**ALRT alerts:**
- Score ≥ 200 (above alert threshold)
- WILL create cases automatically
- Will trigger case workflows

---

## 🎯 Mapping Reference

### **DWH Transaction → NATS Payload Mapping**

```
DWH Field              → NATS Field
--------------------   → ----------------------------------------
end_to_end_id         → transaction.FIToFIPmtSts.TxInfAndSts.OrgnlEndToEndId
tx_tp                 → transaction.TxTp
source (account)      → transaction.FIToFIPmtSts.TxInfAndSts.InstgAgt.FinInstnId.ClrSysMmbId.MmbId
destination (account) → transaction.FIToFIPmtSts.TxInfAndSts.InstdAgt.FinInstnId.ClrSysMmbId.MmbId
amt                   → transaction.FIToFIPmtSts.TxInfAndSts.ChrgsInf[0].Amt.Amt
ccy                   → transaction.FIToFIPmtSts.TxInfAndSts.ChrgsInf[0].Amt.Ccy
msg_id                → transaction.FIToFIPmtSts.GrpHdr.MsgId
cre_dt_tm             → transaction.FIToFIPmtSts.GrpHdr.CreDtTm
tx_sts                → transaction.FIToFIPmtSts.TxInfAndSts.TxSts
tenant_id             → transaction.TenantId
```

---

## 🚀 How to Use

### **Step 1: Re-seed DWH Database**

```powershell
cd backend
Get-Content prismaDWH\setup-five-customers.sql | npx prisma db execute --schema=prismaDWH/schema.dwh.prisma --stdin
```

This will:
- Delete old data
- Insert customers with proper FSP account IDs
- Insert transactions with matching structure

### **Step 2: Test with Alert Payloads**

Use the payloads in `test-alerts/alert-payloads.json` to test alert ingestion.

**Example: Send Alert #1 (NALT) via REST API:**

```bash
POST http://localhost:3000/api/v1/triage/alerts/ingest
Content-Type: application/json
Authorization: Bearer YOUR_JWT_TOKEN

{
  "tenant_id": "T001",
  "priority": "NEW",
  "source": "NATS",
  ...
  # Use payload from alert-payloads.json[0]
}
```

**Example: Send Alert #6 (ALRT) via REST API:**

```bash
POST http://localhost:3000/api/v1/triage/alerts/ingest
Content-Type: application/json
Authorization: Bearer YOUR_JWT_TOKEN

{
  "tenant_id": "T001",
  "priority": "URGENT",
  "source": "NATS",
  ...
  # Use payload from alert-payloads.json[5]
}
```

### **Step 3: Verify Customer Profile Loads**

After alert creates a case and task:

```bash
# Get customer profile by transaction ID
GET http://localhost:3000/api/v1/dwh/customer/profile/TXN-001-02
Authorization: Bearer YOUR_JWT_TOKEN
```

**Expected Response:**

```json
{
  "customerDetails": [{
    "customerName": "John Smith",
    "dateOfBirth": "1985-03-15",
    "email": "john.smith@email.com",
    "phone": "+1-555-0101"
  }],
  "address": [{
    "street": "123 Main St",
    "city": "New York",
    "state": "NY",
    "postalCode": "10001",
    "country": "USA"
  }],
  "accountDetails": {
    "sender": [{
      "accountId": "fsp001",
      "accountType": "personal",
      "balance": 25000.00,
      "riskRating": "Low"
    }],
    "receiver": [{
      "accountId": "fsp001",
      "accountType": "personal",
      "balance": 25000.00,
      "riskRating": "Low"
    }]
  }
}
```

---

## 📊 Testing Matrix

| Alert | Type | Customer | Transaction | Expected Behavior |
|-------|------|----------|-------------|-------------------|
| 1-5 | NALT | All 5 | Various | Alert stored, NO case created |
| 6 | ALRT | John Smith | TXN-001-02 | Case + Task created, profile available |
| 7 | ALRT | Jane Doe | TXN-002-02 | Case + Task created, profile available |
| 8 | ALRT | Robert Johnson | TXN-003-02 | Case + Task created, profile available |
| 9 | ALRT | Sarah Williams | TXN-004-03 | Case + Task created, profile available |
| 10 | ALRT | Michael Brown | TXN-005-01 | Case + Task created, profile available |

---

## ✅ Key Points

1. **FSP IDs = Account IDs**: `fsp001`, `fsp002`, etc. are now account identifiers in DWH
2. **Transaction IDs Match**: NATS `OrgnlEndToEndId` matches DWH `end_to_end_id`
3. **NALT vs ALRT**: 
   - NALT (score < 200): Alert only, no case
   - ALRT (score ≥ 200): Creates case and tasks
4. **Customer Profile**: Loads via transaction ID from DWH
5. **No Code Changes Needed**: System already supports this flow!

---

## 🎯 Next Steps

1. Re-run DWH seed script with updated data
2. Test NALT alerts (verify no case created)
3. Test ALRT alerts (verify case + task created)
4. Navigate to task and verify customer profile loads
5. Frontend should display sender/receiver account details automatically

---

**All ready to test!** 🚀
