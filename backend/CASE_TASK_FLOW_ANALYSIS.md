# Case and Task Creation Flow Analysis

## Current Alert Processing Flow

### 1. Alert Processing Entry Points

#### A. System-to-System (`/api/v1/cases/system`)
```
CaseService.createCaseSystemTransmission() 
→ Emits 'alert.incoming' event
→ TriageService.handleIncomingAlertEvent()
→ TriageService.processIncomingAlert()
```

#### B. Manual Case Creation (`/api/v1/cases/manual`)
```
CaseService.manualCaseCreate()
→ Requires alert.status = "NALT"
→ Creates case + approval task (if needed)
→ Links alert to case
```

#### C. Direct Triage Processing
```
Direct call to TriageService.processIncomingAlert()
```

### 2. Alert Status-Based Processing

#### NALT Status Alerts
```typescript
if (submitAlertDto.report.status === 'NALT') {
  → TriageService.handleNotAlert()
  → Creates alert record only (no case)
  → No task creation
  → Returns early
}
```

#### ART Status Alerts (and others)
```typescript
// Continues to handleNewAlert()
→ TriageService.handleNewAlert()
→ Creates case via CaseWorkflowService.createCase()
→ Creates alert record linked to case
→ Emits 'case.created' event → Flowable process starts
→ Checks TRIAGE_TYPE configuration
```

### 3. Task Creation Based on Triage Type

#### AI Triage
```typescript
case 'AI':
→ TriageService.handleAITriage()
→ Creates triage task: candidateGroup='Analysts'
→ Runs AI prediction
→ Based on prediction results:
  - Creates investigation tasks
  - Auto-closes cases  
  - Creates child cases (FRAUD + AML)
```

#### Manual Triage  
```typescript
case 'MANUAL':
→ TaskService.createTask()
→ Task: name='Triage Alert', candidateGroup='Analysts'
```

#### Disabled/Default
```typescript
case 'DISABLED':
→ TaskService.createTask() 
→ Task: name='Investigate Case', candidateGroup='Investigations'
→ Emits 'case.update.requested' → STATUS_02_READY_FOR_ASSIGNMENT
```

### 4. Event Flow for Database ↔ Flowable Sync

#### Case Creation
```
Case created → case.created event → FlowableEventListener.handleCaseCreated()
→ FlowableService.startProcessInstance() with businessKey=caseId
```

#### Task Creation
```
Task created → task.created event → FlowableEventListener.handleTaskCreated()
→ Gets process by businessKey (caseId)
→ Checks for duplicate tasks  
→ FlowableService.createTask() with candidateGroups
```

## Identified Issues

### 1. ✅ FIXED: Work Queue Assignment Gap
**Problem**: Tasks created with candidateGroup but no work_queue_id
**Fix Applied**: Auto-assign work_queue_id during task creation based on candidateGroup matching

### 2. 🔍 POTENTIAL: Candidate Group Mismatch  
**Problem**: Hard-coded candidateGroup values may not match Work Queue names/roles
**Current Values**: 
- 'Analysts' (AI/Manual triage)
- 'Investigations' (Default case)
- 'supervisors' (Manual case approval - if needed)

### 3. 🔍 POTENTIAL: Event Timing Issues
**Problem**: Flowable task creation might fail if:
- Process instance not fully initialized
- Duplicate task detection logic too strict
- Network/timeout issues with Flowable API

### 4. 🔍 POTENTIAL: Missing Error Handling
**Problem**: Task creation failures in Flowable don't fail the database transaction
**Result**: Task exists in DB but not in Flowable (inconsistent state)

## Verification Steps Needed

1. **Check Work Queue Setup**: Verify work queues exist with correct names/roles matching candidateGroup values
2. **Monitor Event Logs**: Check if case.created and task.created events are being emitted and handled
3. **Verify Flowable Integration**: Confirm Flowable processes and tasks are being created successfully
4. **Test ART Alert Flow**: Process an ART status alert end-to-end and trace the complete flow
5. **Check Database Consistency**: Verify tasks exist in both database and Flowable

## Recommended Fixes

### Immediate (High Priority)
1. **Add comprehensive logging** to track the complete ART alert processing flow
2. **Verify Work Queue configuration** matches candidateGroup values  
3. **Add error handling** for Flowable task creation failures

### Follow-up (Medium Priority) 
1. **Implement transaction rollback** if Flowable operations fail
2. **Add health checks** for Flowable connectivity
3. **Create reconciliation service** to sync database ↔ Flowable inconsistencies