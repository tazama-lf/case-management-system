# Work Queue Management - End-to-End Testing Guide

## Table of Contents

1. [Testing Prerequisites](#testing-prerequisites)
2. [Environment Setup](#environment-setup)
3. [Authentication](#authentication)
4. [Test Scenarios](#test-scenarios)
5. [cURL Examples](#curl-examples)
6. [WebSocket Testing](#websocket-testing)
7. [Performance Testing](#performance-testing)
8. [Automated Test Scripts](#automated-test-scripts)
9. [Troubleshooting](#troubleshooting)

---

## Testing Prerequisites

### Required Tools

- **cURL**: Command-line HTTP client
- **Node.js**: For WebSocket client testing
- **jq**: JSON processor for parsing responses
- **Postman** (optional): GUI for API testing
- **Artillery** or **Apache Bench** (optional): For load testing

### Installation

```bash
# macOS
brew install curl jq node

# Install WebSocket client libraries
npm install -g socket.io-client

# Optional: Install Artillery for load testing
npm install -g artillery
```

### Test Data Requirements

1. **Valid JWT Token**: Obtain via login endpoint
2. **Tenant ID**: Your organization's tenant identifier
3. **User IDs**: UUIDs of users to assign to queues
4. **Test Cases**: Create test cases with various priorities and amounts

### Environment Setup

```bash
# Set up environment variables
export API_BASE_URL="http://localhost:3000"
export API_VERSION="v1"
export WORK_QUEUE_ENDPOINT="${API_BASE_URL}/api/${API_VERSION}/work-queues"
```

---

## Environment Setup

### 1. Start the Application

```bash
cd /Users/mayhem/Projects/Tazama/case-management-system/backend

# Install dependencies
npm install

# Run database migrations
npx prisma migrate deploy
npx prisma generate

# Seed test data (if available)
npm run seed

# Start in development mode
npm run start:dev

# Or start in production mode
npm run start:prod
```

### 2. Verify Application Health

```bash
# Check if server is running
curl -I http://localhost:3000/health

# Expected: HTTP 200 OK
```

### 3. Access Swagger Documentation

Open your browser and navigate to:
```
http://localhost:3000/api
```

This provides an interactive API documentation interface.

---

## Authentication

### 1. Login and Obtain JWT Token

```bash
# Login as supervisor
curl -X POST ${API_BASE_URL}/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "supervisor@tazama.org",
    "password": "SupervisorPass123!"
  }' | jq -r '.access_token'

# Save token to environment variable
export SUPERVISOR_TOKEN=$(curl -s -X POST ${API_BASE_URL}/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "supervisor@tazama.org",
    "password": "SupervisorPass123!"
  }' | jq -r '.access_token')

echo "Supervisor Token: ${SUPERVISOR_TOKEN}"
```

```bash
# Login as investigator
export INVESTIGATOR_TOKEN=$(curl -s -X POST ${API_BASE_URL}/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "investigator@tazama.org",
    "password": "InvestigatorPass123!"
  }' | jq -r '.access_token')

echo "Investigator Token: ${INVESTIGATOR_TOKEN}"
```

### 2. Verify Token

```bash
# Decode JWT to see claims (requires jq and base64)
echo $SUPERVISOR_TOKEN | cut -d '.' -f 2 | base64 -d 2>/dev/null | jq .

# Expected output includes:
# {
#   "clientId": "user-uuid",
#   "tenantId": "tenant-uuid",
#   "roles": ["CMS_SUPERVISOR"],
#   "exp": 1234567890
# }
```

---

## Test Scenarios

### Scenario 1: Complete Work Queue Setup

**Objective**: Create a work queue, assign users, and configure assignment rules.

#### Step 1.1: Create Work Queue

```bash
curl -X POST ${WORK_QUEUE_ENDPOINT} \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "High Priority Fraud Investigations",
    "description": "Queue for urgent fraud cases requiring immediate attention",
    "roles": ["CMS_INVESTIGATOR", "CMS_SUPERVISOR"]
  }' | jq .

# Save work queue ID
export QUEUE_ID=$(curl -s -X POST ${WORK_QUEUE_ENDPOINT} \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Queue $(date +%s)",
    "description": "Automated test queue",
    "roles": ["CMS_INVESTIGATOR"]
  }' | jq -r '.workQueueId')

echo "Created Queue ID: ${QUEUE_ID}"
```

**Expected Response**:
```json
{
  "workQueueId": "550e8400-e29b-41d4-a716-446655440000",
  "name": "High Priority Fraud Investigations",
  "description": "Queue for urgent fraud cases requiring immediate attention",
  "tenantId": "tenant-uuid",
  "isActive": true,
  "createdByUserId": "supervisor-uuid",
  "roles": ["CMS_INVESTIGATOR", "CMS_SUPERVISOR"],
  "members": [],
  "createdAt": "2025-10-18T10:00:00.000Z",
  "updatedAt": "2025-10-18T10:00:00.000Z"
}
```

#### Step 1.2: Verify Queue Creation

```bash
# Get queue details
curl -X GET ${WORK_QUEUE_ENDPOINT}/${QUEUE_ID} \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}" | jq .

# List all queues
curl -X GET "${WORK_QUEUE_ENDPOINT}?page=1&limit=10" \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}" | jq .
```

#### Step 1.3: Assign Users to Queue

```bash
# Replace with actual user IDs from your database
export USER_ID_1="user-uuid-1"
export USER_ID_2="user-uuid-2"
export USER_ID_3="user-uuid-3"

curl -X POST ${WORK_QUEUE_ENDPOINT}/${QUEUE_ID}/members \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "userIds": ["'${USER_ID_1}'", "'${USER_ID_2}'", "'${USER_ID_3}'"],
    "role": "CMS_INVESTIGATOR"
  }' | jq .
```

**Expected Response**:
```json
{
  "workQueueId": "queue-uuid",
  "workQueueName": "High Priority Fraud Investigations",
  "addedCount": 3,
  "members": [
    {
      "userId": "user-uuid-1",
      "role": "CMS_INVESTIGATOR",
      "addedAt": "2025-10-18T10:01:00.000Z"
    },
    {
      "userId": "user-uuid-2",
      "role": "CMS_INVESTIGATOR",
      "addedAt": "2025-10-18T10:01:00.000Z"
    },
    {
      "userId": "user-uuid-3",
      "role": "CMS_INVESTIGATOR",
      "addedAt": "2025-10-18T10:01:00.000Z"
    }
  ]
}
```

#### Step 1.4: Verify User Assignment

```bash
# List queue members
curl -X GET ${WORK_QUEUE_ENDPOINT}/${QUEUE_ID}/members \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}" | jq .

# Get user's assignments
curl -X GET ${WORK_QUEUE_ENDPOINT}/users/${USER_ID_1}/assignments \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}" | jq .
```

#### Step 1.5: Create Assignment Rule

```bash
curl -X POST ${WORK_QUEUE_ENDPOINT}/${QUEUE_ID}/rules \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "ruleName": "Critical High-Value Cases",
    "triggerType": "TASK_CREATION",
    "conditions": {
      "allMustMatch": true,
      "rules": [
        {
          "attribute": "case.priority",
          "operator": "equals",
          "value": "HIGH"
        },
        {
          "attribute": "case.amount",
          "operator": "greaterThan",
          "value": 50000
        }
      ]
    },
    "action": {
      "assignmentType": "SPECIFIC_USER",
      "targetUserId": "'${USER_ID_1}'"
    },
    "priorityOrder": 1,
    "stopOnMatch": true,
    "isActive": true
  }' | jq .

# Save rule ID
export RULE_ID=$(curl -s -X POST ${WORK_QUEUE_ENDPOINT}/${QUEUE_ID}/rules \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "ruleName": "Round Robin Default",
    "triggerType": "TASK_CREATION",
    "conditions": {
      "allMustMatch": true,
      "rules": []
    },
    "action": {
      "assignmentType": "ROUND_ROBIN"
    },
    "priorityOrder": 100,
    "stopOnMatch": true,
    "isActive": true
  }' | jq -r '.ruleId')

echo "Created Rule ID: ${RULE_ID}"
```

**Expected Response**:
```json
{
  "ruleId": "rule-uuid",
  "workQueueId": "queue-uuid",
  "ruleName": "Critical High-Value Cases",
  "triggerType": "TASK_CREATION",
  "conditions": {
    "allMustMatch": true,
    "rules": [
      {
        "attribute": "case.priority",
        "operator": "equals",
        "value": "HIGH"
      },
      {
        "attribute": "case.amount",
        "operator": "greaterThan",
        "value": 50000
      }
    ]
  },
  "action": {
    "assignmentType": "SPECIFIC_USER",
    "targetUserId": "user-uuid-1"
  },
  "priorityOrder": 1,
  "stopOnMatch": true,
  "isActive": true,
  "createdByUserId": "supervisor-uuid",
  "lastEvaluatedAt": null,
  "totalEvaluations": 0,
  "successfulAssignments": 0,
  "failedAssignments": 0,
  "createdAt": "2025-10-18T10:02:00.000Z",
  "updatedAt": "2025-10-18T10:02:00.000Z"
}
```

#### Step 1.6: Verify Rule Creation

```bash
# List all rules for queue
curl -X GET ${WORK_QUEUE_ENDPOINT}/${QUEUE_ID}/rules \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}" | jq .

# Get specific rule details
curl -X GET ${WORK_QUEUE_ENDPOINT}/${QUEUE_ID}/rules/${RULE_ID} \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}" | jq .
```

**✅ Success Criteria**:
- Work queue created with correct name and roles
- Users successfully assigned to queue
- Assignment rules created and active
- All data retrievable via GET endpoints

---

### Scenario 2: Task Creation and Auto-Assignment

**Objective**: Test automatic task assignment when tasks are created.

#### Step 2.1: Create Test Case

```bash
# Create a high-priority, high-value case
export CASE_ID=$(curl -s -X POST ${API_BASE_URL}/api/v1/cases \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "priority": "HIGH",
    "type": "FRAUD_INVESTIGATION",
    "amount": 75000,
    "channel": "MOBILE",
    "country": "KE",
    "description": "Suspicious high-value transaction flagged by ML model"
  }' | jq -r '.caseId')

echo "Created Case ID: ${CASE_ID}"
```

#### Step 2.2: Create Task (Triggers Auto-Assignment)

```bash
export TASK_ID=$(curl -s -X POST ${API_BASE_URL}/api/v1/tasks \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "caseId": "'${CASE_ID}'",
    "taskType": "INVESTIGATE",
    "name": "Investigate High-Value Suspicious Transaction",
    "workQueueId": "'${QUEUE_ID}'",
    "slaDeadline": "'$(date -u -v+24H +"%Y-%m-%dT%H:%M:%SZ")'"
  }' | jq -r '.taskId')

echo "Created Task ID: ${TASK_ID}"
```

#### Step 2.3: Verify Auto-Assignment

```bash
# Get task details to check assignment
curl -X GET ${API_BASE_URL}/api/v1/tasks/${TASK_ID} \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}" | jq .

# Expected: assignedUserId should be USER_ID_1 (from specific user rule)
```

**Expected Response**:
```json
{
  "taskId": "task-uuid",
  "caseId": "case-uuid",
  "name": "Investigate High-Value Suspicious Transaction",
  "status": "STATUS_10_ASSIGNED",
  "workQueueId": "queue-uuid",
  "assignedUserId": "user-uuid-1",
  "slaDeadline": "2025-10-19T10:00:00.000Z",
  "createdAt": "2025-10-18T10:05:00.000Z",
  "updatedAt": "2025-10-18T10:05:00.000Z"
}
```

#### Step 2.4: Check Rule Statistics

```bash
# Get rule details to see evaluation counts
curl -X GET ${WORK_QUEUE_ENDPOINT}/${QUEUE_ID}/rules/${RULE_ID} \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}" | jq .

# Expected: totalEvaluations = 1, successfulAssignments = 1
```

#### Step 2.5: Check Audit Logs

```bash
# Query audit logs for auto-assignment events
curl -X GET ${API_BASE_URL}/api/v1/audit-logs?operation=AUTO_ASSIGN \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}" | jq .

# Query audit logs for rule evaluation
curl -X GET ${API_BASE_URL}/api/v1/audit-logs?operation=EVALUATE_RULE \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}" | jq .
```

#### Step 2.6: Test Medium Priority Case (Should Use Round Robin)

```bash
# Create medium priority case
export CASE_ID_2=$(curl -s -X POST ${API_BASE_URL}/api/v1/cases \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "priority": "MEDIUM",
    "type": "TRANSACTION_REVIEW",
    "amount": 5000
  }' | jq -r '.caseId')

# Create task (should skip first rule, use round robin)
export TASK_ID_2=$(curl -s -X POST ${API_BASE_URL}/api/v1/tasks \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "caseId": "'${CASE_ID_2}'",
    "taskType": "REVIEW",
    "name": "Review Medium Priority Transaction",
    "workQueueId": "'${QUEUE_ID}'"
  }' | jq -r '.taskId')

# Verify assignment (should be USER_ID_1, USER_ID_2, or USER_ID_3 via round robin)
curl -X GET ${API_BASE_URL}/api/v1/tasks/${TASK_ID_2} \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}" | jq '.assignedUserId'
```

**✅ Success Criteria**:
- High-value case automatically assigned to USER_ID_1 (specific user rule)
- Medium priority case assigned via round robin
- Rule evaluation counts incremented correctly
- Audit logs show EVALUATE_RULE and AUTO_ASSIGN operations

---

### Scenario 3: SLA Monitoring and Alerts

**Objective**: Test SLA warning and breach detection.

#### Step 3.1: Create Task with Near-Deadline SLA

```bash
# Create task with SLA deadline 1.5 hours from now
export SLA_DEADLINE=$(date -u -v+90M +"%Y-%m-%dT%H:%M:%SZ")

export SLA_TASK_ID=$(curl -s -X POST ${API_BASE_URL}/api/v1/tasks \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "caseId": "'${CASE_ID}'",
    "taskType": "URGENT_REVIEW",
    "name": "Urgent: SLA Test Task",
    "workQueueId": "'${QUEUE_ID}'",
    "slaDeadline": "'${SLA_DEADLINE}'"
  }' | jq -r '.taskId')

echo "Created SLA Test Task: ${SLA_TASK_ID}"
echo "SLA Deadline: ${SLA_DEADLINE}"
```

#### Step 3.2: Manually Trigger SLA Check

```bash
# Trigger immediate SLA check (instead of waiting for cron)
curl -X POST ${WORK_QUEUE_ENDPOINT}/sla/trigger \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}" | jq .
```

**Expected Response**:
```json
{
  "message": "SLA check triggered successfully",
  "executionTime": "2.3s",
  "warnings": 1,
  "breaches": 0,
  "overdue": 0
}
```

#### Step 3.3: Verify SLA Statistics

```bash
curl -X GET ${WORK_QUEUE_ENDPOINT}/sla/statistics \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}" | jq .
```

**Expected Response**:
```json
{
  "totalTasksWithSLA": 2,
  "warningsIssued": 1,
  "breachesDetected": 0,
  "overdueCount": 0,
  "lastCheckAt": "2025-10-18T10:10:00.000Z"
}
```

#### Step 3.4: Create Breached Task

```bash
# Create task with SLA deadline in the past
export PAST_DEADLINE=$(date -u -v-2H +"%Y-%m-%dT%H:%M:%SZ")

export BREACH_TASK_ID=$(curl -s -X POST ${API_BASE_URL}/api/v1/tasks \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "caseId": "'${CASE_ID}'",
    "taskType": "REVIEW",
    "name": "Already Breached Task",
    "workQueueId": "'${QUEUE_ID}'",
    "slaDeadline": "'${PAST_DEADLINE}'"
  }' | jq -r '.taskId')

echo "Created Breached Task: ${BREACH_TASK_ID}"
```

#### Step 3.5: Trigger SLA Check Again

```bash
curl -X POST ${WORK_QUEUE_ENDPOINT}/sla/trigger \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}" | jq .

# Expected: breaches = 1
```

#### Step 3.6: Get SLA Breach Tasks

```bash
curl -X GET ${WORK_QUEUE_ENDPOINT}/${QUEUE_ID}/sla-breaches \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}" | jq .
```

**Expected Response**:
```json
[
  {
    "taskId": "breach-task-uuid",
    "taskName": "Already Breached Task",
    "caseId": "case-uuid",
    "casePriority": "HIGH",
    "slaDeadline": "2025-10-18T08:10:00.000Z",
    "breachDuration": 7200,
    "breachSeverity": "HIGH",
    "assignedUserId": "user-uuid-1",
    "workQueueName": "High Priority Fraud Investigations"
  }
]
```

#### Step 3.7: Check Notification Logs

```bash
# Check if emails were sent (check email inbox or logs)
tail -f /path/to/logs/notification.log

# Or query notification service
curl -X GET ${API_BASE_URL}/api/v1/notifications?type=TASK_SLA_BREACH \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}" | jq .
```

**✅ Success Criteria**:
- Near-deadline task triggers SLA warning event
- Warning notification sent to supervisor and assignee
- Breached task triggers SLA breach event
- Breach notification sent with severity indicator
- Statistics show correct counts
- Email templates properly formatted

---

### Scenario 4: WebSocket Real-Time Updates

**Objective**: Test real-time event broadcasting via WebSocket.

#### Step 4.1: Create WebSocket Test Client

```javascript
// ws-test.js
const io = require('socket.io-client');

const token = process.env.SUPERVISOR_TOKEN;
const workQueueId = process.env.QUEUE_ID;

const socket = io('http://localhost:3000/work-queues', {
  auth: { token }
});

socket.on('connect', () => {
  console.log('✅ Connected:', socket.id);
  
  // Subscribe to work queue
  socket.emit('subscribe:workQueue', { workQueueId });
  
  // Confirm subscription
  setTimeout(() => {
    socket.emit('subscriptions:list');
  }, 500);
});

socket.on('subscriptions', (data) => {
  console.log('📋 Subscriptions:', data.subscriptions);
});

// Task events
socket.on('task.created', (data) => {
  console.log('🆕 Task Created:', JSON.stringify(data, null, 2));
});

socket.on('task.assigned', (data) => {
  console.log('👤 Task Assigned:', JSON.stringify(data, null, 2));
});

socket.on('task.auto-assigned', (data) => {
  console.log('🤖 Task Auto-Assigned:', JSON.stringify(data, null, 2));
});

socket.on('task.status-changed', (data) => {
  console.log('🔄 Task Status Changed:', JSON.stringify(data, null, 2));
});

socket.on('task.sla-warning', (data) => {
  console.log('⚠️  SLA Warning:', JSON.stringify(data, null, 2));
});

socket.on('task.sla-breach', (data) => {
  console.log('🚨 SLA Breach:', JSON.stringify(data, null, 2));
});

socket.on('task.overdue', (data) => {
  console.log('📅 Task Overdue:', JSON.stringify(data, null, 2));
});

// Work queue events
socket.on('workQueue.updated', (data) => {
  console.log('🔧 Work Queue Updated:', JSON.stringify(data, null, 2));
});

socket.on('workQueue.deleted', (data) => {
  console.log('🗑️  Work Queue Deleted:', JSON.stringify(data, null, 2));
});

// Rule events
socket.on('rule.created', (data) => {
  console.log('📜 Rule Created:', JSON.stringify(data, null, 2));
});

socket.on('rule.updated', (data) => {
  console.log('📝 Rule Updated:', JSON.stringify(data, null, 2));
});

socket.on('rule.deleted', (data) => {
  console.log('🗑️  Rule Deleted:', JSON.stringify(data, null, 2));
});

socket.on('disconnect', () => {
  console.log('❌ Disconnected');
});

socket.on('connect_error', (error) => {
  console.error('❌ Connection Error:', error.message);
});

// Keep alive
console.log('🔌 Connecting to WebSocket...');
console.log('Press Ctrl+C to exit');
```

#### Step 4.2: Start WebSocket Client

```bash
# Install socket.io-client if not already installed
npm install socket.io-client

# Run client
node ws-test.js
```

#### Step 4.3: Test Task Creation Event

In another terminal:

```bash
# Create a new task
curl -X POST ${API_BASE_URL}/api/v1/tasks \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "caseId": "'${CASE_ID}'",
    "taskType": "REVIEW",
    "name": "WebSocket Test Task",
    "workQueueId": "'${QUEUE_ID}'"
  }'
```

**Expected WebSocket Output**:
```
🆕 Task Created: {
  "taskId": "task-uuid",
  "taskName": "WebSocket Test Task",
  "caseId": "case-uuid",
  "casePriority": "HIGH",
  "workQueueId": "queue-uuid",
  "workQueueName": "High Priority Fraud Investigations",
  "timestamp": "2025-10-18T10:15:00.000Z",
  "tenantId": "tenant-uuid"
}
🤖 Task Auto-Assigned: {
  "taskId": "task-uuid",
  "assignedUserId": "user-uuid-2",
  "assignmentType": "ROUND_ROBIN",
  ...
}
```

#### Step 4.4: Test Status Change Event

```bash
# Update task status
curl -X PATCH ${API_BASE_URL}/api/v1/tasks/${TASK_ID} \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "STATUS_20_IN_PROGRESS"
  }'
```

**Expected WebSocket Output**:
```
🔄 Task Status Changed: {
  "taskId": "task-uuid",
  "oldStatus": "STATUS_10_ASSIGNED",
  "newStatus": "STATUS_20_IN_PROGRESS",
  "changedBy": "user-uuid",
  ...
}
```

#### Step 4.5: Test Work Queue Update Event

```bash
# Update work queue
curl -X PUT ${WORK_QUEUE_ENDPOINT}/${QUEUE_ID} \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Updated description via test"
  }'
```

**Expected WebSocket Output**:
```
🔧 Work Queue Updated: {
  "workQueueId": "queue-uuid",
  "changes": {
    "description": "Updated description via test"
  },
  ...
}
```

#### Step 4.6: Test Connection Stats

```bash
# Get connection statistics (if endpoint exists)
curl -X GET ${WORK_QUEUE_ENDPOINT}/websocket/stats \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}" | jq .
```

**✅ Success Criteria**:
- WebSocket client connects successfully
- Client receives all broadcasted events in real-time
- Events contain complete payload data
- No duplicate or missed events
- Connection remains stable under load

---

### Scenario 5: Supervisor Dashboard and Metrics

**Objective**: Test dashboard aggregation and performance.

#### Step 5.1: Get Supervisor Dashboard

```bash
curl -X GET ${WORK_QUEUE_ENDPOINT}/dashboard/supervisor \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}" | jq .
```

**Expected Response**:
```json
{
  "supervisorId": "supervisor-uuid",
  "totalWorkQueues": 1,
  "totalTasks": 6,
  "totalActiveTasks": 5,
  "aggregatedTaskCounts": [
    { "status": "STATUS_01_UNASSIGNED", "count": 0 },
    { "status": "STATUS_10_ASSIGNED", "count": 3 },
    { "status": "STATUS_20_IN_PROGRESS", "count": 2 },
    { "status": "STATUS_30_COMPLETED", "count": 1 }
  ],
  "aggregatedSLAMetrics": {
    "overdueCount": 0,
    "breachCount": 1,
    "atRiskCount": 1,
    "onTrackCount": 3,
    "avgCompletionTime": 4.2,
    "complianceRate": 83.3
  },
  "workQueueMetrics": [
    {
      "workQueueId": "queue-uuid",
      "workQueueName": "High Priority Fraud Investigations",
      "totalTasks": 6,
      "activeTasks": 5,
      "taskCountsByStatus": [...],
      "slaMetrics": {...},
      "assignedUserCount": 3,
      "calculatedAt": "2025-10-18T10:20:00.000Z"
    }
  ],
  "totalAssignedUsers": 3,
  "generatedAt": "2025-10-18T10:20:00.000Z",
  "refreshInterval": 60
}
```

#### Step 5.2: Measure Dashboard Performance

```bash
# Time the dashboard request
time curl -X GET ${WORK_QUEUE_ENDPOINT}/dashboard/supervisor \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}" -o /dev/null -s -w "Time: %{time_total}s\n"

# Expected: < 2 seconds
```

#### Step 5.3: Check Dashboard Audit Log

```bash
curl -X GET ${API_BASE_URL}/api/v1/audit-logs?operation=VIEW_DASHBOARD \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}" | jq '.[0]'
```

**Expected Response**:
```json
{
  "auditLogId": "audit-uuid",
  "userId": "supervisor-uuid",
  "operation": "VIEW_DASHBOARD",
  "entityName": "WorkQueue",
  "actionPerformed": {
    "filters": {},
    "summary": {
      "workQueuesQueried": 1,
      "tasksProcessed": 6,
      "executionTime": "1.23s"
    }
  },
  "outcome": "SUCCESS",
  "performedAt": "2025-10-18T10:20:00.000Z"
}
```

#### Step 5.4: Get Queue Metrics

```bash
curl -X GET ${WORK_QUEUE_ENDPOINT}/${QUEUE_ID}/metrics \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}" | jq .
```

#### Step 5.5: Check Metrics Audit Log

```bash
curl -X GET ${API_BASE_URL}/api/v1/audit-logs?operation=VIEW_METRICS \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}" | jq '.[0]'
```

#### Step 5.6: Test Concurrent Dashboard Requests

```bash
# Run 10 concurrent requests
for i in {1..10}; do
  curl -X GET ${WORK_QUEUE_ENDPOINT}/dashboard/supervisor \
    -H "Authorization: Bearer ${SUPERVISOR_TOKEN}" \
    -o /dev/null -s -w "Request $i: %{time_total}s\n" &
done
wait

# Verify no database connection errors
# Check all requests complete successfully
```

**✅ Success Criteria**:
- Dashboard returns within 2 seconds
- All metrics calculated correctly
- Audit log created with performance data
- Concurrent requests handled gracefully
- No memory leaks or connection exhaustion

---

### Scenario 6: Assignment Rule Priority and Stop-on-Match

**Objective**: Test rule evaluation order and stop-on-match behavior.

#### Step 6.1: Create Priority-Ordered Rules

```bash
# Rule 1: Highest priority - Critical cases to senior investigator
curl -X POST ${WORK_QUEUE_ENDPOINT}/${QUEUE_ID}/rules \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "ruleName": "Critical Cases - Senior Investigator",
    "triggerType": "TASK_CREATION",
    "conditions": {
      "allMustMatch": true,
      "rules": [
        {
          "attribute": "case.priority",
          "operator": "equals",
          "value": "HIGH"
        },
        {
          "attribute": "case.amount",
          "operator": "greaterThan",
          "value": 100000
        }
      ]
    },
    "action": {
      "assignmentType": "SPECIFIC_USER",
      "targetUserId": "'${USER_ID_1}'"
    },
    "priorityOrder": 1,
    "stopOnMatch": true,
    "isActive": true
  }' | jq -r '.ruleId' > rule1.txt

export RULE_1=$(cat rule1.txt)
echo "Rule 1 (Priority 1): ${RULE_1}"

# Rule 2: Medium priority - High priority cases
curl -X POST ${WORK_QUEUE_ENDPOINT}/${QUEUE_ID}/rules \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "ruleName": "High Priority Cases - Load Balanced",
    "triggerType": "TASK_CREATION",
    "conditions": {
      "allMustMatch": true,
      "rules": [
        {
          "attribute": "case.priority",
          "operator": "equals",
          "value": "HIGH"
        }
      ]
    },
    "action": {
      "assignmentType": "LOAD_BALANCED",
      "workload": {
        "maxTasksPerUser": 10,
        "considerPriority": true
      }
    },
    "priorityOrder": 2,
    "stopOnMatch": true,
    "isActive": true
  }' | jq -r '.ruleId' > rule2.txt

export RULE_2=$(cat rule2.txt)
echo "Rule 2 (Priority 2): ${RULE_2}"

# Rule 3: Lowest priority - Default round robin
curl -X POST ${WORK_QUEUE_ENDPOINT}/${QUEUE_ID}/rules \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "ruleName": "Default Assignment",
    "triggerType": "TASK_CREATION",
    "conditions": {
      "allMustMatch": true,
      "rules": []
    },
    "action": {
      "assignmentType": "ROUND_ROBIN"
    },
    "priorityOrder": 100,
    "stopOnMatch": true,
    "isActive": true
  }' | jq -r '.ruleId' > rule3.txt

export RULE_3=$(cat rule3.txt)
echo "Rule 3 (Priority 100): ${RULE_3}"
```

#### Step 6.2: Test Case A - Should Match Rule 1

```bash
# Create case: HIGH priority + amount > 100,000
export TEST_CASE_A=$(curl -s -X POST ${API_BASE_URL}/api/v1/cases \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "priority": "HIGH",
    "type": "FRAUD_INVESTIGATION",
    "amount": 150000
  }' | jq -r '.caseId')

# Create task
export TEST_TASK_A=$(curl -s -X POST ${API_BASE_URL}/api/v1/tasks \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "caseId": "'${TEST_CASE_A}'",
    "name": "Test Case A - Critical",
    "workQueueId": "'${QUEUE_ID}'"
  }' | jq -r '.taskId')

# Verify assignment
curl -X GET ${API_BASE_URL}/api/v1/tasks/${TEST_TASK_A} \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}" | jq '.assignedUserId'

# Expected: USER_ID_1
```

#### Step 6.3: Test Case B - Should Match Rule 2

```bash
# Create case: HIGH priority + amount < 100,000
export TEST_CASE_B=$(curl -s -X POST ${API_BASE_URL}/api/v1/cases \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "priority": "HIGH",
    "type": "FRAUD_INVESTIGATION",
    "amount": 50000
  }' | jq -r '.caseId')

# Create task
export TEST_TASK_B=$(curl -s -X POST ${API_BASE_URL}/api/v1/tasks \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "caseId": "'${TEST_CASE_B}'",
    "name": "Test Case B - High Priority",
    "workQueueId": "'${QUEUE_ID}'"
  }' | jq -r '.taskId')

# Verify assignment
curl -X GET ${API_BASE_URL}/api/v1/tasks/${TEST_TASK_B} \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}" | jq '.assignedUserId'

# Expected: USER_ID with least workload (load balanced)
```

#### Step 6.4: Test Case C - Should Match Rule 3

```bash
# Create case: MEDIUM priority
export TEST_CASE_C=$(curl -s -X POST ${API_BASE_URL}/api/v1/cases \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "priority": "MEDIUM",
    "type": "TRANSACTION_REVIEW",
    "amount": 10000
  }' | jq -r '.caseId')

# Create task
export TEST_TASK_C=$(curl -s -X POST ${API_BASE_URL}/api/v1/tasks \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "caseId": "'${TEST_CASE_C}'",
    "name": "Test Case C - Medium Priority",
    "workQueueId": "'${QUEUE_ID}'"
  }' | jq -r '.taskId')

# Verify assignment
curl -X GET ${API_BASE_URL}/api/v1/tasks/${TEST_TASK_C} \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}" | jq '.assignedUserId'

# Expected: Next user in round robin rotation
```

#### Step 6.5: Verify Rule Statistics

```bash
# Check Rule 1 stats
curl -X GET ${WORK_QUEUE_ENDPOINT}/${QUEUE_ID}/rules/${RULE_1} \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}" | jq '{
    ruleName: .ruleName,
    totalEvaluations: .totalEvaluations,
    successfulAssignments: .successfulAssignments,
    failedAssignments: .failedAssignments
  }'

# Expected: totalEvaluations = 1, successfulAssignments = 1

# Check Rule 2 stats
curl -X GET ${WORK_QUEUE_ENDPOINT}/${QUEUE_ID}/rules/${RULE_2} \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}" | jq '{
    ruleName: .ruleName,
    totalEvaluations: .totalEvaluations,
    successfulAssignments: .successfulAssignments
  }'

# Expected: totalEvaluations = 2 (cases A & B), successfulAssignments = 1 (case B)

# Check Rule 3 stats
curl -X GET ${WORK_QUEUE_ENDPOINT}/${QUEUE_ID}/rules/${RULE_3} \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}" | jq '{
    ruleName: .ruleName,
    totalEvaluations: .totalEvaluations,
    successfulAssignments: .successfulAssignments
  }'

# Expected: totalEvaluations = 3 (all cases), successfulAssignments = 1 (case C)
```

**✅ Success Criteria**:
- Test Case A: Assigned to USER_ID_1 via Rule 1
- Test Case B: Assigned via load balancing (Rule 2)
- Test Case C: Assigned via round robin (Rule 3)
- Rule statistics reflect correct evaluation and assignment counts
- Stop-on-match prevents lower-priority rule execution

---

## cURL Examples

### Complete cURL Command Reference

#### Authentication

```bash
# Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "user@example.com", "password": "password"}'
```

#### Work Queue CRUD

```bash
# Create
curl -X POST ${WORK_QUEUE_ENDPOINT} \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"name": "Queue Name", "description": "Description", "roles": ["CMS_INVESTIGATOR"]}'

# Get by ID
curl -X GET ${WORK_QUEUE_ENDPOINT}/{workQueueId} \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}"

# List all
curl -X GET "${WORK_QUEUE_ENDPOINT}?page=1&limit=10&isActive=true" \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}"

# Get by role
curl -X GET ${WORK_QUEUE_ENDPOINT}/role/CMS_INVESTIGATOR \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}"

# Get statistics
curl -X GET ${WORK_QUEUE_ENDPOINT}/{workQueueId}/statistics \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}"

# Update
curl -X PUT ${WORK_QUEUE_ENDPOINT}/{workQueueId} \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"description": "Updated description"}'

# Deactivate
curl -X PUT ${WORK_QUEUE_ENDPOINT}/{workQueueId}/deactivate \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}"

# Delete
curl -X DELETE ${WORK_QUEUE_ENDPOINT}/{workQueueId} \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}"

# Delete with task reassignment
curl -X DELETE "${WORK_QUEUE_ENDPOINT}/{workQueueId}?reassignQueueId={newQueueId}" \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}"
```

#### User Assignment

```bash
# Assign users
curl -X POST ${WORK_QUEUE_ENDPOINT}/{workQueueId}/members \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"userIds": ["user-uuid-1", "user-uuid-2"], "role": "CMS_INVESTIGATOR"}'

# Remove users
curl -X DELETE ${WORK_QUEUE_ENDPOINT}/{workQueueId}/members \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"userIds": ["user-uuid-1"]}'

# List members
curl -X GET ${WORK_QUEUE_ENDPOINT}/{workQueueId}/members \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}"

# Get user assignments
curl -X GET ${WORK_QUEUE_ENDPOINT}/users/{userId}/assignments \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}"
```

#### Dashboard & Metrics

```bash
# Supervisor dashboard
curl -X GET ${WORK_QUEUE_ENDPOINT}/dashboard/supervisor \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}"

# Queue metrics
curl -X GET ${WORK_QUEUE_ENDPOINT}/{workQueueId}/metrics \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}"

# Filtered tasks
curl -X GET "${WORK_QUEUE_ENDPOINT}/{workQueueId}/tasks?status=STATUS_10_ASSIGNED&page=1&limit=20" \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}"

# Overdue tasks
curl -X GET ${WORK_QUEUE_ENDPOINT}/{workQueueId}/overdue \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}"

# SLA breaches
curl -X GET ${WORK_QUEUE_ENDPOINT}/{workQueueId}/sla-breaches \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}"
```

#### Assignment Rules

```bash
# Create rule
curl -X POST ${WORK_QUEUE_ENDPOINT}/{workQueueId}/rules \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "ruleName": "Rule Name",
    "triggerType": "TASK_CREATION",
    "conditions": {
      "allMustMatch": true,
      "rules": [{"attribute": "case.priority", "operator": "equals", "value": "HIGH"}]
    },
    "action": {"assignmentType": "ROUND_ROBIN"},
    "priorityOrder": 1,
    "stopOnMatch": true,
    "isActive": true
  }'

# List rules
curl -X GET ${WORK_QUEUE_ENDPOINT}/{workQueueId}/rules \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}"

# List active rules only
curl -X GET "${WORK_QUEUE_ENDPOINT}/{workQueueId}/rules?activeOnly=true" \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}"

# Get rule details
curl -X GET ${WORK_QUEUE_ENDPOINT}/{workQueueId}/rules/{ruleId} \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}"

# Update rule
curl -X PUT ${WORK_QUEUE_ENDPOINT}/{workQueueId}/rules/{ruleId} \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"ruleName": "Updated Name", "isActive": true}'

# Delete rule
curl -X DELETE ${WORK_QUEUE_ENDPOINT}/{workQueueId}/rules/{ruleId} \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}"

# Activate rule
curl -X POST ${WORK_QUEUE_ENDPOINT}/{workQueueId}/rules/{ruleId}/activate \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}"

# Deactivate rule
curl -X POST ${WORK_QUEUE_ENDPOINT}/{workQueueId}/rules/{ruleId}/deactivate \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}"
```

---

## WebSocket Testing

See [Scenario 4](#scenario-4-websocket-real-time-updates) for complete WebSocket testing.

### Quick WebSocket Connection Test

```javascript
// quick-ws-test.js
const io = require('socket.io-client');

const socket = io('http://localhost:3000/work-queues', {
  auth: { token: process.env.SUPERVISOR_TOKEN }
});

socket.on('connect', () => console.log('Connected!'));
socket.on('connect_error', (err) => console.error('Error:', err.message));
socket.on('disconnect', () => console.log('Disconnected'));

setTimeout(() => socket.close(), 5000);
```

---

## Performance Testing

### Load Test: Concurrent Task Creation

```bash
# Create load-test.sh
cat > load-test.sh << 'EOF'
#!/bin/bash
TOKEN=$1
QUEUE_ID=$2
CASE_ID=$3
ITERATIONS=${4:-100}

for i in $(seq 1 $ITERATIONS); do
  curl -X POST http://localhost:3000/api/v1/tasks \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"caseId\": \"$CASE_ID\",
      \"name\": \"Load Test Task $i\",
      \"workQueueId\": \"$QUEUE_ID\"
    }" \
    -o /dev/null -s -w "Task $i: %{time_total}s\n" &
  
  # Limit to 10 concurrent requests
  if [[ $((i % 10)) -eq 0 ]]; then
    wait
  fi
done
wait
EOF

chmod +x load-test.sh

# Run load test
./load-test.sh "${SUPERVISOR_TOKEN}" "${QUEUE_ID}" "${CASE_ID}" 50
```

### Artillery Load Test

```yaml
# artillery-config.yml
config:
  target: "http://localhost:3000"
  phases:
    - duration: 60
      arrivalRate: 10
      name: "Warm up"
    - duration: 120
      arrivalRate: 50
      name: "Sustained load"
    - duration: 60
      arrivalRate: 100
      name: "Peak load"
  processor: "./load-test-processor.js"

scenarios:
  - name: "Work Queue Operations"
    flow:
      - post:
          url: "/api/v1/work-queues"
          headers:
            Authorization: "Bearer {{ token }}"
            Content-Type: "application/json"
          json:
            name: "Load Test Queue {{ $randomString() }}"
            description: "Automated load test"
            roles: ["CMS_INVESTIGATOR"]
      - get:
          url: "/api/v1/work-queues/dashboard/supervisor"
          headers:
            Authorization: "Bearer {{ token }}"
```

Run Artillery:
```bash
artillery run artillery-config.yml
```

---

## Automated Test Scripts

### Jest E2E Test Example

```typescript
// work-queue.e2e.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Work Queue E2E', () => {
  let app: INestApplication;
  let supervisorToken: string;
  let workQueueId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Login
    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        username: 'supervisor@test.com',
        password: 'TestPass123!',
      });

    supervisorToken = loginResponse.body.access_token;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Work Queue Creation', () => {
    it('should create a work queue', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/work-queues')
        .set('Authorization', `Bearer ${supervisorToken}`)
        .send({
          name: 'E2E Test Queue',
          description: 'Test queue',
          roles: ['CMS_INVESTIGATOR'],
        })
        .expect(201);

      expect(response.body).toHaveProperty('workQueueId');
      expect(response.body.name).toBe('E2E Test Queue');
      
      workQueueId = response.body.workQueueId;
    });

    it('should prevent duplicate queue names', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/work-queues')
        .set('Authorization', `Bearer ${supervisorToken}`)
        .send({
          name: 'E2E Test Queue',
          description: 'Duplicate',
          roles: ['CMS_INVESTIGATOR'],
        })
        .expect(409);
    });
  });

  describe('Assignment Rules', () => {
    it('should create an assignment rule', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/work-queues/${workQueueId}/rules`)
        .set('Authorization', `Bearer ${supervisorToken}`)
        .send({
          ruleName: 'Test Rule',
          triggerType: 'TASK_CREATION',
          conditions: {
            allMustMatch: true,
            rules: [
              {
                attribute: 'case.priority',
                operator: 'equals',
                value: 'HIGH',
              },
            ],
          },
          action: {
            assignmentType: 'ROUND_ROBIN',
          },
          priorityOrder: 1,
          stopOnMatch: true,
          isActive: true,
        })
        .expect(201);

      expect(response.body).toHaveProperty('ruleId');
      expect(response.body.ruleName).toBe('Test Rule');
    });
  });

  // Add more test suites...
});
```

---

## Troubleshooting

### Common Issues

#### Issue: "Unauthorized" Error

**Symptoms**:
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

**Solutions**:
1. Verify JWT token is valid:
   ```bash
   echo $SUPERVISOR_TOKEN | cut -d '.' -f 2 | base64 -d 2>/dev/null | jq .
   ```
2. Check token expiration
3. Re-login and obtain new token

#### Issue: "Forbidden - Requires CMS_SUPERVISOR role"

**Symptoms**:
```json
{
  "statusCode": 403,
  "message": "Forbidden resource"
}
```

**Solutions**:
1. Verify user has correct role
2. Check JWT claims contain required role
3. Use supervisor token for supervisor-only endpoints

#### Issue: "Work queue not found"

**Symptoms**:
```json
{
  "statusCode": 404,
  "message": "Work queue not found"
}
```

**Solutions**:
1. Verify work queue ID is correct
2. Check tenant isolation (queue belongs to your tenant)
3. Confirm queue was not deleted

#### Issue: Assignment Rule Not Triggering

**Debugging Steps**:
1. Check rule is active:
   ```bash
   curl -X GET ${WORK_QUEUE_ENDPOINT}/${QUEUE_ID}/rules/${RULE_ID} \
     -H "Authorization: Bearer ${SUPERVISOR_TOKEN}" | jq '.isActive'
   ```
2. Verify rule conditions match task attributes
3. Check rule priority order (higher priority rules evaluated first)
4. Review audit logs for rule evaluation:
   ```bash
   curl -X GET ${API_BASE_URL}/api/v1/audit-logs?operation=EVALUATE_RULE \
     -H "Authorization: Bearer ${SUPERVISOR_TOKEN}" | jq .
   ```

#### Issue: SLA Checks Not Running

**Debugging Steps**:
1. Check cron service is enabled
2. Verify SLA monitoring service logs
3. Trigger manual SLA check:
   ```bash
   curl -X POST ${WORK_QUEUE_ENDPOINT}/sla/trigger \
     -H "Authorization: Bearer ${SUPERVISOR_TOKEN}"
   ```
4. Check database for tasks with `sla_deadline`

#### Issue: WebSocket Not Connecting

**Debugging Steps**:
1. Verify WebSocket URL and namespace:
   ```javascript
   const socket = io('http://localhost:3000/work-queues');
   ```
2. Check JWT token in auth:
   ```javascript
   socket.handshake.auth = { token: 'valid-jwt-token' };
   ```
3. Review CORS configuration
4. Check network/firewall rules

#### Issue: Slow Dashboard Performance

**Optimization Steps**:
1. Check database indexes:
   ```sql
   EXPLAIN ANALYZE SELECT * FROM task WHERE work_queue_id = 'uuid';
   ```
2. Review query execution time in audit logs
3. Consider pagination or caching for large datasets
4. Monitor database connection pool

### Debugging Tools

#### Enable Debug Logging

```bash
# Set debug environment variable
export DEBUG=*
npm run start:dev
```

#### Database Query Logging

```typescript
// In prisma.service.ts
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});
```

#### Check Application Logs

```bash
# View logs in real-time
tail -f logs/application.log

# Search for errors
grep -i "error" logs/application.log

# Filter by timestamp
awk '/2025-10-18T10:00/,/2025-10-18T11:00/' logs/application.log
```

---

## Test Data Cleanup

### Clean Up Test Data

```bash
# Delete test work queues
curl -X GET ${WORK_QUEUE_ENDPOINT}?name=Test \
  -H "Authorization: Bearer ${SUPERVISOR_TOKEN}" | \
  jq -r '.items[].workQueueId' | \
  while read queue_id; do
    curl -X DELETE ${WORK_QUEUE_ENDPOINT}/$queue_id \
      -H "Authorization: Bearer ${SUPERVISOR_TOKEN}"
  done

# Or use database cleanup
psql -d cms -c "DELETE FROM work_queue WHERE name LIKE 'Test%';"
```

---

## Conclusion

This testing guide provides comprehensive coverage of all work queue features. For production deployments:

1. **Automate Testing**: Implement CI/CD pipelines with automated E2E tests
2. **Monitor Performance**: Set up monitoring for API response times and database queries
3. **Load Testing**: Regularly perform load tests to ensure scalability
4. **Security Testing**: Conduct security audits of authentication and authorization
5. **Documentation**: Keep testing procedures updated as features evolve

**Next Steps**:
- Implement automated test suite using Jest/Supertest
- Set up continuous integration with GitHub Actions
- Configure performance monitoring with tools like New Relic or DataDog
- Create Postman collection for manual API testing

---

**Last Updated**: October 18, 2025  
**Version**: 1.0.0  
**Maintainer**: Tazama Development Team
