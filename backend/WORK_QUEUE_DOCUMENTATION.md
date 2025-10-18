# Work Queue Management System - Complete Documentation

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Features](#features)
4. [API Endpoints](#api-endpoints)
5. [Database Schema](#database-schema)
6. [Real-Time Features](#real-time-features)
7. [Assignment Rules Engine](#assignment-rules-engine)
8. [SLA Monitoring](#sla-monitoring)
9. [Notifications](#notifications)
10. [Testing Guide](#testing-guide)
11. [Configuration](#configuration)
12. [Deployment](#deployment)

---

## Overview

The Work Queue Management System is a comprehensive task organization and assignment system designed for the Tazama Case Management System. It provides sophisticated work distribution, automated task assignment, SLA monitoring, and real-time updates for investigators and supervisors.

### Key Capabilities

- **Work Queue Management**: Create, update, and manage multiple work queues per tenant
- **User Assignment**: Flexible user and role-based assignment to work queues
- **Automated Task Assignment**: Rule-based automatic task distribution with 14 operators and 19 attributes
- **SLA Monitoring**: Automated monitoring of task deadlines with warnings and breach detection
- **Real-Time Updates**: WebSocket-based live updates for task status changes
- **Supervisor Dashboard**: Comprehensive metrics and analytics for supervisors
- **Audit Logging**: Complete audit trail of all operations
- **Multi-Tenancy**: Full tenant isolation and security

---

## Architecture

### Module Structure

```
backend/src/work-queue/
├── dto/                              # Data Transfer Objects
│   ├── assign-user.dto.ts           # User assignment DTOs
│   ├── assignment-rule.dto.ts       # Rule configuration DTOs
│   ├── create-work-queue.dto.ts     # Work queue creation
│   ├── get-work-queues-query.dto.ts # Query/filter DTOs
│   ├── update-work-queue.dto.ts     # Work queue updates
│   ├── work-queue-metrics.dto.ts    # Metrics and dashboard DTOs
│   ├── work-queue-response.dto.ts   # Response DTOs
│   └── index.ts                     # Barrel exports
├── assignment-rule.service.ts       # Assignment rule management
├── rule-engine.service.ts           # Rule evaluation engine
├── sla-monitoring.service.ts        # SLA checks and monitoring
├── work-queue.controller.ts         # REST API endpoints
├── work-queue.gateway.ts            # WebSocket gateway
├── work-queue.module.ts             # Module configuration
└── work-queue.service.ts            # Core business logic
```

### Dependencies

```typescript
// Module Imports
PrismaModule        // Database access
AuthModule          // Authentication/authorization
AuditLogModule      // Audit logging
EventEmitterModule  // Event-driven architecture

// External Packages
@nestjs/websockets
@nestjs/platform-socket.io
socket.io
@nestjs/schedule
@nestjs/event-emitter
```

### Service Layers

1. **Controller Layer** (`work-queue.controller.ts`)
   - REST API endpoints
   - Request validation
   - Response formatting
   - Swagger documentation

2. **Service Layer** (`work-queue.service.ts`)
   - Business logic
   - Database operations
   - Event emission
   - Audit logging

3. **Rule Engine** (`rule-engine.service.ts` + `assignment-rule.service.ts`)
   - Rule evaluation
   - Attribute extraction
   - Operator implementation
   - Conflict detection

4. **Real-Time Layer** (`work-queue.gateway.ts`)
   - WebSocket connections
   - Event broadcasting
   - Room management
   - Connection tracking

5. **Monitoring Layer** (`sla-monitoring.service.ts`)
   - Cron-based checks
   - SLA calculation
   - Breach detection
   - Statistics generation

---

## Features

### 1. Work Queue Management

#### Work Queue Entity

A work queue represents a collection of tasks grouped by:
- Team/department
- Case type
- Priority level
- Geographic region
- Any custom criteria

**Properties**:
- `work_queue_id` (UUID): Unique identifier
- `name` (String): Queue name
- `description` (String, optional): Queue description
- `tenant_id` (UUID): Tenant isolation
- `is_active` (Boolean): Active status
- `created_by_user_id` (UUID): Creator
- `created_at`, `updated_at`: Timestamps

**Associated Data**:
- **Roles**: Multiple roles can access a queue
- **Members**: Users assigned to the queue
- **Tasks**: Cases/tasks in the queue
- **Assignment Rules**: Automated assignment rules

### 2. User Assignment

#### Assignment Types

1. **Direct User Assignment**
   - Assign specific users to work queues
   - Bulk assign/remove operations
   - Role-based assignment

2. **Role-Based Access**
   - Assign roles to work queues
   - Users inherit access via their roles
   - Dynamic access based on role changes

#### Member Management

**Operations**:
- Add users to queue
- Remove users from queue
- List queue members
- View user's queue assignments

### 3. Automated Task Assignment Rules

Sophisticated rule engine for automatic task distribution.

#### Rule Types

1. **TASK_CREATION**: Triggered when task is created
2. **CASE_PRIORITY_CHANGE**: Triggered on priority change
3. **TASK_REASSIGNMENT**: Triggered on reassignment
4. **SLA_APPROACHING**: Triggered when SLA deadline approaches
5. **MANUAL**: Manually triggered rules

#### Rule Structure

```typescript
{
  ruleName: string;
  triggerType: AssignmentRuleType;
  conditions: {
    allMustMatch: boolean;  // AND vs OR logic
    rules: [{
      attribute: string;    // What to check
      operator: string;     // How to compare
      value: any;          // What to compare against
    }]
  };
  action: {
    assignmentType: 'SPECIFIC_USER' | 'ROUND_ROBIN' | 'LOAD_BALANCED' | 'SKILL_BASED';
    targetUserId?: string;
    workload?: {
      maxTasksPerUser: number;
      considerPriority: boolean;
    };
    skillRequirements?: string[];
  };
  priorityOrder: number;   // Execution order
  stopOnMatch: boolean;    // Stop after match?
  isActive: boolean;       // Rule enabled?
}
```

#### Supported Attributes (19 total)

**Case Attributes**:
- `case.priority`: HIGH | MEDIUM | LOW
- `case.status`: Case status
- `case.type`: Case type
- `case.createdAt`: Creation timestamp
- `case.amount`: Transaction amount
- `case.channel`: Transaction channel
- `case.country`: Country code
- `case.assignedInvestigator`: Currently assigned user

**Task Attributes**:
- `task.type`: Task type
- `task.name`: Task name
- `task.status`: Task status
- `task.createdAt`: Creation timestamp
- `task.slaDeadline`: SLA deadline

**Work Queue Attributes**:
- `workQueue.name`: Queue name
- `workQueue.currentLoad`: Current task count
- `workQueue.avgCompletionTime`: Average completion time

**User Attributes**:
- `user.skills`: User skill tags
- `user.currentWorkload`: User's current task count
- `user.roles`: User roles
- `user.availability`: User availability status

#### Supported Operators (14 total)

**Comparison**:
- `equals`: Exact match
- `notEquals`: Not equal to
- `greaterThan`: Numeric/date greater than
- `lessThan`: Numeric/date less than
- `greaterThanOrEqual`: >=
- `lessThanOrEqual`: <=

**String**:
- `contains`: Substring match
- `notContains`: Does not contain
- `startsWith`: Begins with
- `endsWith`: Ends with

**List/Array**:
- `in`: Value in list
- `notIn`: Value not in list

**Advanced**:
- `isEmpty`: Empty/null check
- `isNotEmpty`: Not empty/null

#### Assignment Strategies

1. **Specific User**: Assign to a particular user
2. **Round Robin**: Rotate through available users
3. **Load Balanced**: Assign to user with least workload
4. **Skill Based**: Match task requirements to user skills

### 4. SLA Monitoring & Alerts

Automated monitoring of task Service Level Agreements.

#### Monitoring Schedule

- **Cron Job**: Runs every 5 minutes (configurable)
- **Mutex Lock**: Prevents overlapping executions
- **Graceful Failure**: Logs errors, continues operation

#### Check Types

##### SLA Warning Check

**Criteria**:
- Task has `sla_deadline` set
- Deadline within warning threshold (default: 2 hours)
- Task not completed
- Not recently checked (30-minute debounce)

**Actions**:
- Emits `task.sla-warning` event
- Broadcasts via WebSocket
- Sends notification to supervisor and assignee

##### SLA Breach Check

**Criteria**:
- Task has `sla_deadline` set
- Deadline passed with grace period (default: 15 minutes)
- Task not completed

**Severity Levels**:
```typescript
CRITICAL: >24h breach on HIGH priority case
HIGH:     >24h breach OR >4h on HIGH priority
MEDIUM:   >4h breach OR >1h on MEDIUM priority  
LOW:      >1h breach OR any on LOW priority
INFO:     <1h breach
```

**Actions**:
- Emits `task.sla-breach` event
- Broadcasts via WebSocket
- Sends urgent notification
- Escalates CRITICAL to management

##### Overdue Task Check

**Criteria**:
- Task created >72 hours ago
- Task not completed
- Not recently checked (1-hour debounce)

**Actions**:
- Emits `task.overdue` event
- Broadcasts via WebSocket
- Sends notification for review

#### Configuration

```bash
# Environment Variables
SLA_WARNING_THRESHOLD_HOURS=2    # Hours before deadline
SLA_GRACE_PERIOD_MINUTES=15      # Minutes after deadline
```

### 5. Real-Time Updates (WebSocket)

Socket.io-based real-time communication for live updates.

#### Gateway Configuration

```typescript
Namespace: /work-queues
Port: Configurable via environment
CORS: Enabled for cross-origin
Transport: WebSocket with polling fallback
```

#### Authentication

**Required**: JWT token in handshake
```javascript
socket.handshake.auth.token
```

**Validated**: User ID and tenant ID extracted

#### Room Subscriptions

Clients subscribe to specific rooms for targeted updates:

1. **Work Queue Room**: `workQueue:{workQueueId}`
   - Receives updates for specific queue

2. **Tenant Room**: `tenant:{tenantId}`
   - Receives all updates for tenant

#### Subscription API

```typescript
// Subscribe to work queue
socket.emit('subscribe:workQueue', { workQueueId: 'uuid' });

// Subscribe to tenant
socket.emit('subscribe:workQueue', { tenantId: 'uuid' });

// Unsubscribe
socket.emit('unsubscribe:workQueue', { workQueueId: 'uuid' });

// List subscriptions
socket.emit('subscriptions:list');
// Response: { subscriptions: ['workQueue:xxx', 'tenant:yyy'] }
```

#### Broadcast Events (13 total)

**Task Events**:
- `task.created`
- `task.status-changed`
- `task.assigned`
- `task.unassigned`
- `task.auto-assigned`
- `task.sla-warning`
- `task.sla-breach`
- `task.overdue`

**Work Queue Events**:
- `workQueue.updated`
- `workQueue.deleted`

**Rule Events**:
- `rule.created`
- `rule.updated`
- `rule.deleted`

#### Event Payload Structure

```typescript
{
  taskId: string;
  taskName: string;
  caseId: string;
  casePriority: string;
  workQueueId: string;
  workQueueName: string;
  assignedUserId?: string;
  timestamp: Date;
  tenantId: string;
  // Event-specific fields...
}
```

### 6. Notifications

Email notifications for critical events.

#### Notification Types

1. **TASK_SLA_WARNING**: Task approaching deadline
2. **TASK_SLA_BREACH**: Task has breached SLA
3. **TASK_OVERDUE**: Task overdue for review

#### Notification Recipients

**SLA Warning**:
- Supervisor (configurable email)
- Assigned user (if exists)

**SLA Breach**:
- Supervisor
- Senior management (CRITICAL severity only)
- Assigned user

**Overdue Task**:
- Supervisor
- Assigned user

#### Email Templates

Professional HTML templates with:
- Color-coded styling (warning/breach/overdue)
- Detailed task/case information tables
- Priority highlighting
- Action recommendations
- Time metrics

#### Configuration

```bash
SUPERVISOR_EMAIL=supervisor@example.com
MANAGEMENT_EMAIL=management@example.com
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=notifications@example.com
SMTP_PASS=password
MAIL_FROM="CMS Notifications" <no-reply@cms.local>
```

### 7. Supervisor Dashboard

Comprehensive analytics and metrics for supervisors.

#### Dashboard Features

**Aggregated Metrics**:
- Total work queues supervised
- Total tasks across all queues
- Active vs completed tasks
- Task counts by status

**SLA Metrics**:
- Overdue count
- Breach count
- At-risk count
- On-track count
- Average completion time
- SLA compliance rate

**Queue Details**:
- Individual queue metrics
- Assigned user counts
- Task distribution
- Performance trends

**Performance Data**:
- Query execution time
- Data volume processed
- Refresh recommendations

#### Access Control

- Requires **CMS_SUPERVISOR** role
- Scoped to user's assigned queues
- Tenant isolation enforced

### 8. Audit Logging

Complete audit trail for compliance and security.

#### Logged Operations

**Work Queue Operations**:
- CREATE, UPDATE, DELETE work queues
- ACTIVATE, DEACTIVATE queues
- ADD_MEMBERS, REMOVE_MEMBERS

**Assignment Rule Operations**:
- CREATE_RULE, UPDATE_RULE, DELETE_RULE
- ACTIVATE_RULE, DEACTIVATE_RULE
- EVALUATE_RULE, AUTO_ASSIGN

**Dashboard Operations**:
- VIEW_DASHBOARD: Dashboard access with filters and summary
- VIEW_METRICS: Queue metrics retrieval with performance data

#### Audit Log Structure

```typescript
{
  user_id: string;
  operation: string;
  entity_name: string;
  action_performed: string | JSON;  // Can include complex data
  outcome: 'SUCCESS' | 'FAILED';
  performed_at: Date;
}
```

#### Performance Tracking

Dashboard audits include:
- Execution duration
- Filters applied
- Data volume
- Query statistics

---

## API Endpoints

### Base URL

```
http://localhost:3000/api/v1/work-queues
```

### Authentication

All endpoints require JWT Bearer token:
```
Authorization: Bearer <jwt-token>
```

### Endpoints Summary

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| **Work Queue Management** |
| GET | `/` | List all work queues | Investigator/Supervisor |
| GET | `/:workQueueId` | Get work queue details | Investigator/Supervisor |
| GET | `/role/:roleName` | Get queues by role | Investigator/Supervisor |
| GET | `/:workQueueId/statistics` | Get queue statistics | Investigator/Supervisor |
| POST | `/` | Create work queue | Supervisor |
| PUT | `/:workQueueId` | Update work queue | Supervisor |
| PUT | `/:workQueueId/deactivate` | Deactivate queue | Supervisor |
| DELETE | `/:workQueueId` | Delete work queue | Supervisor |
| **User Assignment** |
| POST | `/:workQueueId/members` | Assign users to queue | Supervisor |
| DELETE | `/:workQueueId/members` | Remove users from queue | Supervisor |
| GET | `/:workQueueId/members` | List queue members | Investigator/Supervisor |
| GET | `/users/:userId/assignments` | Get user's assignments | Investigator/Supervisor |
| **Dashboard & Metrics** |
| GET | `/dashboard/supervisor` | Supervisor dashboard | Supervisor |
| GET | `/:workQueueId/metrics` | Queue metrics | Investigator/Supervisor |
| GET | `/:workQueueId/tasks` | Queue tasks with filters | Investigator/Supervisor |
| GET | `/:workQueueId/overdue` | Overdue tasks | Investigator/Supervisor |
| GET | `/:workQueueId/sla-breaches` | SLA breach tasks | Investigator/Supervisor |
| **Assignment Rules** |
| POST | `/:workQueueId/rules` | Create assignment rule | Supervisor |
| GET | `/:workQueueId/rules` | List rules | Supervisor |
| GET | `/:workQueueId/rules/:ruleId` | Get rule details | Supervisor |
| PUT | `/:workQueueId/rules/:ruleId` | Update rule | Supervisor |
| DELETE | `/:workQueueId/rules/:ruleId` | Delete rule | Supervisor |
| POST | `/:workQueueId/rules/:ruleId/activate` | Activate rule | Supervisor |
| POST | `/:workQueueId/rules/:ruleId/deactivate` | Deactivate rule | Supervisor |

### Detailed Endpoint Documentation

#### 1. List All Work Queues

```http
GET /api/v1/work-queues?page=1&limit=10&isActive=true
```

**Query Parameters**:
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 10)
- `isActive` (boolean, optional): Filter by active status
- `name` (string, optional): Filter by name (partial match)

**Response** (200 OK):
```json
{
  "items": [
    {
      "workQueueId": "uuid",
      "name": "Investigations Queue",
      "description": "Queue for investigation tasks",
      "isActive": true,
      "createdByUserId": "uuid",
      "roles": ["CMS_INVESTIGATOR"],
      "memberCount": 5,
      "taskCount": 23,
      "createdAt": "2025-10-18T10:00:00Z",
      "updatedAt": "2025-10-18T10:00:00Z"
    }
  ],
  "total": 50,
  "page": 1,
  "limit": 10,
  "totalPages": 5
}
```

#### 2. Create Work Queue

```http
POST /api/v1/work-queues
```

**Request Body**:
```json
{
  "name": "High Priority Queue",
  "description": "Queue for high priority cases",
  "roles": ["CMS_INVESTIGATOR", "CMS_SUPERVISOR"]
}
```

**Response** (201 Created):
```json
{
  "workQueueId": "uuid",
  "name": "High Priority Queue",
  "description": "Queue for high priority cases",
  "tenantId": "uuid",
  "isActive": true,
  "createdByUserId": "uuid",
  "roles": ["CMS_INVESTIGATOR", "CMS_SUPERVISOR"],
  "members": [],
  "createdAt": "2025-10-18T10:00:00Z",
  "updatedAt": "2025-10-18T10:00:00Z"
}
```

#### 3. Assign Users to Queue

```http
POST /api/v1/work-queues/:workQueueId/members
```

**Request Body**:
```json
{
  "userIds": ["user-uuid-1", "user-uuid-2"],
  "role": "CMS_INVESTIGATOR"
}
```

**Response** (200 OK):
```json
{
  "workQueueId": "uuid",
  "workQueueName": "Investigations Queue",
  "addedCount": 2,
  "members": [
    {
      "userId": "user-uuid-1",
      "role": "CMS_INVESTIGATOR",
      "addedAt": "2025-10-18T10:00:00Z"
    },
    {
      "userId": "user-uuid-2",
      "role": "CMS_INVESTIGATOR",
      "addedAt": "2025-10-18T10:00:00Z"
    }
  ]
}
```

#### 4. Create Assignment Rule

```http
POST /api/v1/work-queues/:workQueueId/rules
```

**Request Body**:
```json
{
  "ruleName": "High Priority Auto-Assignment",
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
        "value": 10000
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
  "priorityOrder": 1,
  "stopOnMatch": true,
  "isActive": true
}
```

**Response** (201 Created):
```json
{
  "ruleId": "uuid",
  "workQueueId": "uuid",
  "ruleName": "High Priority Auto-Assignment",
  "triggerType": "TASK_CREATION",
  "conditions": { /* as above */ },
  "action": { /* as above */ },
  "priorityOrder": 1,
  "stopOnMatch": true,
  "isActive": true,
  "createdByUserId": "uuid",
  "lastEvaluatedAt": null,
  "totalEvaluations": 0,
  "successfulAssignments": 0,
  "failedAssignments": 0,
  "createdAt": "2025-10-18T10:00:00Z",
  "updatedAt": "2025-10-18T10:00:00Z"
}
```

#### 5. Get Supervisor Dashboard

```http
GET /api/v1/work-queues/dashboard/supervisor
```

**Response** (200 OK):
```json
{
  "supervisorId": "uuid",
  "totalWorkQueues": 3,
  "totalTasks": 47,
  "totalActiveTasks": 35,
  "aggregatedTaskCounts": [
    { "status": "STATUS_10_ASSIGNED", "count": 20 },
    { "status": "STATUS_20_IN_PROGRESS", "count": 15 },
    { "status": "STATUS_30_COMPLETED", "count": 12 }
  ],
  "aggregatedSLAMetrics": {
    "overdueCount": 3,
    "breachCount": 1,
    "atRiskCount": 5,
    "onTrackCount": 26,
    "avgCompletionTime": 4.5,
    "complianceRate": 94.3
  },
  "workQueueMetrics": [
    {
      "workQueueId": "uuid",
      "workQueueName": "Investigations",
      "totalTasks": 23,
      "activeTasks": 18,
      "taskCountsByStatus": [ /* ... */ ],
      "slaMetrics": { /* ... */ },
      "assignedUserCount": 5,
      "calculatedAt": "2025-10-18T10:00:00Z"
    }
  ],
  "totalAssignedUsers": 12,
  "generatedAt": "2025-10-18T10:00:00Z",
  "refreshInterval": 60
}
```

#### 6. Get Work Queue Metrics

```http
GET /api/v1/work-queues/:workQueueId/metrics
```

**Response** (200 OK):
```json
{
  "workQueueId": "uuid",
  "workQueueName": "Investigations Queue",
  "totalTasks": 23,
  "activeTasks": 18,
  "taskCountsByStatus": [
    { "status": "STATUS_01_UNASSIGNED", "count": 3 },
    { "status": "STATUS_10_ASSIGNED", "count": 8 },
    { "status": "STATUS_20_IN_PROGRESS", "count": 7 },
    { "status": "STATUS_30_COMPLETED", "count": 5 }
  ],
  "slaMetrics": {
    "overdueCount": 2,
    "breachCount": 1,
    "atRiskCount": 3,
    "onTrackCount": 12,
    "avgCompletionTime": 3.8,
    "complianceRate": 95.2
  },
  "assignedUserCount": 5,
  "calculatedAt": "2025-10-18T10:00:00Z"
}
```

---

## Database Schema

### Core Tables

#### WorkQueue

```sql
CREATE TABLE work_queue (
  work_queue_id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  tenant_id UUID NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT fk_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id)
);

CREATE INDEX idx_work_queue_tenant ON work_queue(tenant_id);
CREATE INDEX idx_work_queue_active ON work_queue(is_active);
```

#### WorkQueueRole

```sql
CREATE TABLE work_queue_role (
  work_queue_role_id UUID PRIMARY KEY,
  work_queue_id UUID NOT NULL,
  role VARCHAR(100) NOT NULL,
  
  CONSTRAINT fk_work_queue FOREIGN KEY (work_queue_id) 
    REFERENCES work_queue(work_queue_id) ON DELETE CASCADE,
  CONSTRAINT uk_queue_role UNIQUE (work_queue_id, role)
);

CREATE INDEX idx_queue_role ON work_queue_role(work_queue_id);
```

#### WorkQueueMember

```sql
CREATE TABLE work_queue_member (
  work_queue_member_id UUID PRIMARY KEY,
  work_queue_id UUID NOT NULL,
  user_id UUID NOT NULL,
  role VARCHAR(100) NOT NULL,
  added_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT fk_work_queue FOREIGN KEY (work_queue_id) 
    REFERENCES work_queue(work_queue_id) ON DELETE CASCADE,
  CONSTRAINT uk_queue_user UNIQUE (work_queue_id, user_id)
);

CREATE INDEX idx_member_queue ON work_queue_member(work_queue_id);
CREATE INDEX idx_member_user ON work_queue_member(user_id);
```

#### WorkQueueAssignmentRule

```sql
CREATE TABLE work_queue_assignment_rule (
  assignment_rule_id UUID PRIMARY KEY,
  work_queue_id UUID NOT NULL,
  rule_name VARCHAR(255) NOT NULL,
  trigger_type VARCHAR(50) NOT NULL,
  conditions JSONB NOT NULL,
  actions JSONB NOT NULL,
  priority_order INTEGER DEFAULT 0,
  stop_on_match BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_by_user_id UUID NOT NULL,
  last_evaluated_at TIMESTAMP,
  total_evaluations INTEGER DEFAULT 0,
  successful_assignments INTEGER DEFAULT 0,
  failed_assignments INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT fk_work_queue FOREIGN KEY (work_queue_id) 
    REFERENCES work_queue(work_queue_id) ON DELETE CASCADE
);

CREATE INDEX idx_rule_queue ON work_queue_assignment_rule(work_queue_id);
CREATE INDEX idx_rule_trigger ON work_queue_assignment_rule(trigger_type);
CREATE INDEX idx_rule_active ON work_queue_assignment_rule(is_active);
CREATE INDEX idx_rule_priority ON work_queue_assignment_rule(priority_order);
```

#### Task (extended)

```sql
-- Existing task table with work queue support
ALTER TABLE task ADD COLUMN work_queue_id UUID;
ALTER TABLE task ADD COLUMN sla_deadline TIMESTAMP;
ALTER TABLE task ADD COLUMN assigned_user_id UUID;

ALTER TABLE task ADD CONSTRAINT fk_work_queue 
  FOREIGN KEY (work_queue_id) REFERENCES work_queue(work_queue_id);

CREATE INDEX idx_task_queue ON task(work_queue_id);
CREATE INDEX idx_task_sla ON task(sla_deadline);
CREATE INDEX idx_task_assigned ON task(assigned_user_id);
CREATE INDEX idx_task_status ON task(status);
```

### Important Indexes for Performance

```sql
-- SLA Monitoring Performance
CREATE INDEX idx_task_sla_monitoring ON task(sla_deadline, status, updated_at) 
  WHERE sla_deadline IS NOT NULL;

-- Assignment Rule Performance
CREATE INDEX idx_case_priority ON "case"(priority);
CREATE INDEX idx_case_status ON "case"(status);

-- Dashboard Performance
CREATE INDEX idx_task_created_status ON task(created_at, status);
CREATE INDEX idx_task_completed ON task(completed_at) 
  WHERE completed_at IS NOT NULL;

-- Audit Logging Performance
CREATE INDEX idx_audit_user_operation ON audit_log(user_id, operation, performed_at);
CREATE INDEX idx_audit_entity ON audit_log(entity_name, performed_at);
```

---

## Real-Time Features

See [REAL_TIME_MONITORING.md](./REAL_TIME_MONITORING.md) for complete WebSocket documentation.

### Quick Reference

**Connection**:
```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:3000/work-queues', {
  auth: { token: 'your-jwt-token' }
});
```

**Subscribe to Queue**:
```javascript
socket.emit('subscribe:workQueue', { workQueueId: 'uuid' });
```

**Listen for Events**:
```javascript
socket.on('task.created', (data) => console.log('New task:', data));
socket.on('task.sla-warning', (data) => console.log('SLA warning:', data));
socket.on('task.sla-breach', (data) => console.log('SLA breach:', data));
```

---

## Assignment Rules Engine

See [ASSIGNMENT_RULES.md](./ASSIGNMENT_RULES.md) for complete rule documentation.

### Quick Examples

**Round Robin Assignment**:
```json
{
  "ruleName": "Round Robin",
  "triggerType": "TASK_CREATION",
  "conditions": {
    "allMustMatch": true,
    "rules": [
      { "attribute": "case.priority", "operator": "equals", "value": "MEDIUM" }
    ]
  },
  "action": {
    "assignmentType": "ROUND_ROBIN"
  },
  "priorityOrder": 2,
  "stopOnMatch": true
}
```

**Skill-Based Assignment**:
```json
{
  "ruleName": "Fraud Specialist",
  "triggerType": "TASK_CREATION",
  "conditions": {
    "allMustMatch": true,
    "rules": [
      { "attribute": "case.type", "operator": "equals", "value": "FRAUD" },
      { "attribute": "case.amount", "operator": "greaterThan", "value": 5000 }
    ]
  },
  "action": {
    "assignmentType": "SKILL_BASED",
    "skillRequirements": ["fraud-analysis", "high-value"]
  },
  "priorityOrder": 1,
  "stopOnMatch": true
}
```

---

## SLA Monitoring

See [REAL_TIME_MONITORING.md](./REAL_TIME_MONITORING.md) for complete SLA documentation.

### Configuration

```bash
# .env
SLA_WARNING_THRESHOLD_HOURS=2
SLA_GRACE_PERIOD_MINUTES=15

# Notification Recipients
SUPERVISOR_EMAIL=supervisor@example.com
MANAGEMENT_EMAIL=management@example.com
```

### Manual Trigger

For testing or immediate checks:

```bash
# Via cURL
curl -X POST http://localhost:3000/api/v1/work-queues/sla/trigger \
  -H "Authorization: Bearer <token>"
```

```typescript
// Via Service
await slaMonitoringService.triggerSLACheck();
```

---

## Testing Guide

### Prerequisites

1. **Database Setup**:
   ```bash
   cd backend
   npx prisma migrate deploy
   npx prisma generate
   ```

2. **Environment Variables**:
   ```bash
   # Copy example env
   cp .env.example .env
   
   # Configure required variables
   DATABASE_URL=postgresql://user:pass@localhost:5432/cms
   JWT_SECRET=your-secret-key
   SMTP_HOST=smtp.mailtrap.io
   SMTP_PORT=587
   ```

3. **Start Application**:
   ```bash
   npm install
   npm run start:dev
   ```

4. **Access Swagger UI**:
   ```
   http://localhost:3000/api
   ```

### End-to-End Testing Scenarios

#### Scenario 1: Complete Work Queue Setup

**Objective**: Create and configure a work queue with users and rules

**Steps**:

1. **Authenticate**:
   ```bash
   # Get JWT token
   curl -X POST http://localhost:3000/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{
       "username": "supervisor@example.com",
       "password": "password123"
     }'
   
   # Save token
   export TOKEN="<jwt-token>"
   ```

2. **Create Work Queue**:
   ```bash
   curl -X POST http://localhost:3000/api/v1/work-queues \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Test Investigations Queue",
       "description": "Queue for testing",
       "roles": ["CMS_INVESTIGATOR"]
     }'
   
   # Save workQueueId
   export QUEUE_ID="<work-queue-id>"
   ```

3. **Assign Users**:
   ```bash
   curl -X POST http://localhost:3000/api/v1/work-queues/$QUEUE_ID/members \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "userIds": ["user-id-1", "user-id-2"],
       "role": "CMS_INVESTIGATOR"
     }'
   ```

4. **Create Assignment Rule**:
   ```bash
   curl -X POST http://localhost:3000/api/v1/work-queues/$QUEUE_ID/rules \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "ruleName": "Auto-Assign High Priority",
       "triggerType": "TASK_CREATION",
       "conditions": {
         "allMustMatch": true,
         "rules": [{
           "attribute": "case.priority",
           "operator": "equals",
           "value": "HIGH"
         }]
       },
       "action": {
         "assignmentType": "ROUND_ROBIN"
       },
       "priorityOrder": 1,
       "stopOnMatch": true,
       "isActive": true
     }'
   ```

5. **Verify Configuration**:
   ```bash
   # Get work queue details
   curl -X GET http://localhost:3000/api/v1/work-queues/$QUEUE_ID \
     -H "Authorization: Bearer $TOKEN"
   
   # List members
   curl -X GET http://localhost:3000/api/v1/work-queues/$QUEUE_ID/members \
     -H "Authorization: Bearer $TOKEN"
   
   # List rules
   curl -X GET http://localhost:3000/api/v1/work-queues/$QUEUE_ID/rules \
     -H "Authorization: Bearer $TOKEN"
   ```

**Expected Results**:
- ✅ Work queue created with specified name and roles
- ✅ Users successfully assigned to queue
- ✅ Assignment rule created and active
- ✅ All data retrievable via GET endpoints

#### Scenario 2: Task Assignment Flow

**Objective**: Test automatic task assignment when a task is created

**Steps**:

1. **Create High Priority Case** (via case API):
   ```bash
   curl -X POST http://localhost:3000/api/v1/cases \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "priority": "HIGH",
       "type": "FRAUD_INVESTIGATION",
       "amount": 15000
     }'
   
   export CASE_ID="<case-id>"
   ```

2. **Create Task** (triggers rule engine):
   ```bash
   curl -X POST http://localhost:3000/api/v1/tasks \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "caseId": "'$CASE_ID'",
       "taskType": "INVESTIGATE",
       "name": "Investigate High Value Transaction",
       "workQueueId": "'$QUEUE_ID'"
     }'
   
   export TASK_ID="<task-id>"
   ```

3. **Verify Assignment**:
   ```bash
   # Check task details
   curl -X GET http://localhost:3000/api/v1/tasks/$TASK_ID \
     -H "Authorization: Bearer $TOKEN"
   ```

4. **Check Audit Logs**:
   ```bash
   # Via database or audit API
   curl -X GET http://localhost:3000/api/v1/audit-logs?entityName=Task \
     -H "Authorization: Bearer $TOKEN"
   ```

**Expected Results**:
- ✅ Task automatically assigned to a user from the queue
- ✅ Assignment follows round-robin logic
- ✅ `task.auto-assigned` event emitted
- ✅ Audit log created with EVALUATE_RULE and AUTO_ASSIGN entries
- ✅ Rule evaluation count incremented

#### Scenario 3: WebSocket Real-Time Updates

**Objective**: Test real-time notifications via WebSocket

**Setup Client** (JavaScript):
```javascript
import io from 'socket.io-client';

const token = '<jwt-token>';
const workQueueId = '<work-queue-id>';

// Connect
const socket = io('http://localhost:3000/work-queues', {
  auth: { token }
});

socket.on('connect', () => {
  console.log('Connected:', socket.id);
  
  // Subscribe to work queue
  socket.emit('subscribe:workQueue', { workQueueId });
  
  // Confirm subscription
  socket.emit('subscriptions:list');
});

socket.on('subscriptions', (data) => {
  console.log('Subscribed to:', data.subscriptions);
});

// Listen for events
socket.on('task.created', (data) => {
  console.log('Task created:', data);
});

socket.on('task.assigned', (data) => {
  console.log('Task assigned:', data);
});

socket.on('task.sla-warning', (data) => {
  console.log('SLA Warning:', data);
});

socket.on('task.sla-breach', (data) => {
  console.log('SLA Breach:', data);
});

socket.on('disconnect', () => {
  console.log('Disconnected');
});
```

**Test Steps**:

1. **Start WebSocket Client**:
   ```bash
   node websocket-test.js
   ```

2. **Create Task** (in another terminal):
   ```bash
   curl -X POST http://localhost:3000/api/v1/tasks \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{ "caseId": "'$CASE_ID'", "name": "Test Task" }'
   ```

3. **Update Task Status**:
   ```bash
   curl -X PATCH http://localhost:3000/api/v1/tasks/$TASK_ID \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{ "status": "STATUS_20_IN_PROGRESS" }'
   ```

4. **Update Work Queue**:
   ```bash
   curl -X PUT http://localhost:3000/api/v1/work-queues/$QUEUE_ID \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{ "description": "Updated description" }'
   ```

**Expected Results**:
- ✅ Client receives `task.created` event immediately
- ✅ Client receives `task.auto-assigned` event if rule matches
- ✅ Client receives `task.status-changed` event on status update
- ✅ Client receives `workQueue.updated` event
- ✅ All events contain complete payload data

#### Scenario 4: SLA Monitoring

**Objective**: Test SLA warning and breach detection

**Setup**:

1. **Create Task with Near-Deadline SLA**:
   ```bash
   # Calculate SLA deadline (1.5 hours from now)
   DEADLINE=$(date -u -d '+90 minutes' +"%Y-%m-%dT%H:%M:%SZ")
   
   curl -X POST http://localhost:3000/api/v1/tasks \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "caseId": "'$CASE_ID'",
       "name": "SLA Test Task",
       "workQueueId": "'$QUEUE_ID'",
       "slaDeadline": "'$DEADLINE'"
     }'
   
   export SLA_TASK_ID="<task-id>"
   ```

2. **Trigger SLA Check**:
   ```bash
   curl -X POST http://localhost:3000/api/v1/work-queues/sla/trigger \
     -H "Authorization: Bearer $TOKEN"
   ```

3. **Check SLA Statistics**:
   ```bash
   curl -X GET http://localhost:3000/api/v1/work-queues/sla/statistics \
     -H "Authorization: Bearer $TOKEN"
   ```

4. **Monitor Notifications**:
   - Check email inbox (supervisor and assigned user)
   - Check WebSocket client for events
   - Check audit logs

5. **Create Breached Task**:
   ```bash
   # Create task with deadline in past
   PAST_DEADLINE=$(date -u -d '-1 hour' +"%Y-%m-%dT%H:%M:%SZ")
   
   curl -X POST http://localhost:3000/api/v1/tasks \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "caseId": "'$CASE_ID'",
       "name": "Breached Task",
       "workQueueId": "'$QUEUE_ID'",
       "slaDeadline": "'$PAST_DEADLINE'"
     }'
   ```

6. **Trigger Check Again**:
   ```bash
   curl -X POST http://localhost:3000/api/v1/work-queues/sla/trigger \
     -H "Authorization: Bearer $TOKEN"
   ```

**Expected Results**:
- ✅ First task triggers `task.sla-warning` event
- ✅ Warning email sent to supervisor and assignee
- ✅ Second task triggers `task.sla-breach` event
- ✅ Breach email sent with severity indicator
- ✅ Statistics show correct counts
- ✅ WebSocket clients receive all events

#### Scenario 5: Supervisor Dashboard

**Objective**: Test dashboard metrics and performance

**Steps**:

1. **Get Dashboard**:
   ```bash
   curl -X GET http://localhost:3000/api/v1/work-queues/dashboard/supervisor \
     -H "Authorization: Bearer $TOKEN"
   ```

2. **Verify Metrics**:
   - Check `totalWorkQueues` matches assigned queues
   - Verify `totalTasks` aggregates correctly
   - Validate `aggregatedSLAMetrics` calculations
   - Confirm `workQueueMetrics` array completeness

3. **Check Audit Log**:
   ```bash
   curl -X GET http://localhost:3000/api/v1/audit-logs \
     -H "Authorization: Bearer $TOKEN" \
     | jq '.[] | select(.operation == "VIEW_DASHBOARD")'
   ```

4. **Verify Performance Data**:
   - Check execution duration in audit log
   - Verify `workQueuesQueried` count
   - Confirm `tasksProcessed` count

5. **Get Queue Metrics**:
   ```bash
   curl -X GET http://localhost:3000/api/v1/work-queues/$QUEUE_ID/metrics \
     -H "Authorization: Bearer $TOKEN"
   ```

6. **Check Audit for Metrics**:
   ```bash
   curl -X GET http://localhost:3000/api/v1/audit-logs \
     -H "Authorization: Bearer $TOKEN" \
     | jq '.[] | select(.operation == "VIEW_METRICS")'
   ```

**Expected Results**:
- ✅ Dashboard returns within acceptable time (<2 seconds)
- ✅ All metrics calculated correctly
- ✅ Audit logs created with performance data
- ✅ Tenant isolation enforced (only see own queues)
- ✅ Role-based access working (supervisor role required)

#### Scenario 6: Assignment Rule Priority

**Objective**: Test rule priority and stop-on-match behavior

**Setup**:

1. **Create Multiple Rules**:
   ```bash
   # Rule 1: High priority, specific user
   curl -X POST http://localhost:3000/api/v1/work-queues/$QUEUE_ID/rules \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "ruleName": "Critical Cases",
       "triggerType": "TASK_CREATION",
       "conditions": {
         "allMustMatch": true,
         "rules": [{
           "attribute": "case.priority",
           "operator": "equals",
           "value": "HIGH"
         }, {
           "attribute": "case.amount",
           "operator": "greaterThan",
           "value": 50000
         }]
       },
       "action": {
         "assignmentType": "SPECIFIC_USER",
         "targetUserId": "senior-investigator-id"
       },
       "priorityOrder": 1,
       "stopOnMatch": true,
       "isActive": true
     }'
   
   # Rule 2: High priority, round robin
   curl -X POST http://localhost:3000/api/v1/work-queues/$QUEUE_ID/rules \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "ruleName": "High Priority",
       "triggerType": "TASK_CREATION",
       "conditions": {
         "allMustMatch": true,
         "rules": [{
           "attribute": "case.priority",
           "operator": "equals",
           "value": "HIGH"
         }]
       },
       "action": {
         "assignmentType": "ROUND_ROBIN"
       },
       "priorityOrder": 2,
       "stopOnMatch": true,
       "isActive": true
     }'
   ```

2. **Test Cases**:

   **Test Case A**: High priority + high amount
   ```bash
   # Should match Rule 1, assign to specific user, stop
   curl -X POST http://localhost:3000/api/v1/tasks \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "caseId": "<case-with-high-priority-and-60k>",
       "name": "Critical Case",
       "workQueueId": "'$QUEUE_ID'"
     }'
   ```

   **Test Case B**: High priority + low amount
   ```bash
   # Should skip Rule 1, match Rule 2, round robin
   curl -X POST http://localhost:3000/api/v1/tasks \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "caseId": "<case-with-high-priority-and-5k>",
       "name": "Regular High Priority",
       "workQueueId": "'$QUEUE_ID'"
     }'
   ```

   **Test Case C**: Medium priority
   ```bash
   # Should skip both rules, remain unassigned
   curl -X POST http://localhost:3000/api/v1/tasks \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "caseId": "<case-with-medium-priority>",
       "name": "Medium Priority",
       "workQueueId": "'$QUEUE_ID'"
     }'
   ```

3. **Verify Results**:
   ```bash
   # Check rule statistics
   curl -X GET http://localhost:3000/api/v1/work-queues/$QUEUE_ID/rules \
     -H "Authorization: Bearer $TOKEN"
   ```

**Expected Results**:
- ✅ Test Case A: Assigned to senior investigator
- ✅ Test Case B: Assigned via round robin
- ✅ Test Case C: Remains unassigned
- ✅ Rule 1 stats: 1 evaluation, 1 success
- ✅ Rule 2 stats: 2 evaluations (A & B), 1 success (B)
- ✅ Stop-on-match prevents further rule evaluation

### Performance Testing

#### Load Test: Concurrent Task Creation

```bash
# Using Apache Bench
ab -n 100 -c 10 -T 'application/json' \
   -H "Authorization: Bearer $TOKEN" \
   -p task-payload.json \
   http://localhost:3000/api/v1/tasks

# task-payload.json
{
  "caseId": "test-case-id",
  "name": "Load Test Task",
  "workQueueId": "test-queue-id"
}
```

**Metrics to Monitor**:
- Response time (should be <500ms)
- Throughput (tasks/second)
- Rule engine evaluation time
- Database query performance
- WebSocket event broadcast time

#### Stress Test: Dashboard Under Load

```bash
# Concurrent dashboard requests
for i in {1..50}; do
  curl -X GET http://localhost:3000/api/v1/work-queues/dashboard/supervisor \
    -H "Authorization: Bearer $TOKEN" &
done
wait
```

**Expected Performance**:
- Response time <2 seconds
- No database connection exhaustion
- Proper tenant isolation maintained
- Correct metrics under concurrent access

### Automated Testing

#### Unit Tests (To Be Created)

```typescript
// work-queue.service.spec.ts
describe('WorkQueueService', () => {
  describe('createWorkQueue', () => {
    it('should create work queue with roles', async () => {
      // Test implementation
    });
    
    it('should prevent duplicate queue names', async () => {
      // Test implementation
    });
  });
  
  describe('assignUsers', () => {
    it('should assign multiple users', async () => {
      // Test implementation
    });
  });
});

// rule-engine.service.spec.ts
describe('RuleEngineService', () => {
  describe('evaluateRule', () => {
    it('should match rule conditions', async () => {
      // Test implementation
    });
    
    it('should handle complex AND/OR logic', async () => {
      // Test implementation
    });
  });
});
```

#### Integration Tests (To Be Created)

```typescript
// work-queue.e2e.spec.ts
describe('Work Queue E2E', () => {
  it('should complete full workflow', async () => {
    // 1. Create queue
    // 2. Assign users
    // 3. Create rule
    // 4. Create task
    // 5. Verify auto-assignment
    // 6. Check audit logs
  });
});
```

### Manual Testing Checklist

- [ ] Work Queue CRUD operations
- [ ] User assignment (add/remove)
- [ ] Assignment rule creation
- [ ] Assignment rule evaluation
- [ ] Rule priority ordering
- [ ] Stop-on-match behavior
- [ ] Round-robin assignment
- [ ] Load-balanced assignment
- [ ] Skill-based assignment
- [ ] SLA warning detection
- [ ] SLA breach detection
- [ ] Overdue task detection
- [ ] WebSocket connections
- [ ] Real-time event broadcasting
- [ ] Email notifications
- [ ] Supervisor dashboard
- [ ] Queue metrics
- [ ] Audit logging
- [ ] Tenant isolation
- [ ] Role-based access control
- [ ] Error handling
- [ ] Performance under load

---

## Configuration

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/cms

# Authentication
JWT_SECRET=your-secret-key
JWT_EXPIRATION=1h

# SLA Monitoring
SLA_WARNING_THRESHOLD_HOURS=2
SLA_GRACE_PERIOD_MINUTES=15

# Notifications
SUPERVISOR_EMAIL=supervisor@example.com
MANAGEMENT_EMAIL=management@example.com
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=notifications@example.com
SMTP_PASS=password
MAIL_FROM="CMS Notifications" <no-reply@cms.local>

# WebSocket
WEBSOCKET_PORT=3000
WEBSOCKET_PATH=/work-queues

# Application
NODE_ENV=production
PORT=3000
```

### Cron Schedule Configuration

Adjust SLA monitoring frequency in `sla-monitoring.service.ts`:

```typescript
// Every 5 minutes (default)
@Cron('*/5 * * * *')

// Every 2 minutes (high frequency)
@Cron('*/2 * * * *')

// Every 10 minutes (low frequency)
@Cron('*/10 * * * *')

// Every hour
@Cron('0 * * * *')
```

---

## Deployment

### Production Checklist

- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] Database indexes created
- [ ] SMTP configured and tested
- [ ] WebSocket CORS properly configured
- [ ] JWT secrets rotated
- [ ] Monitoring/logging enabled
- [ ] Error tracking configured (e.g., Sentry)
- [ ] Performance monitoring enabled
- [ ] Backup strategy implemented
- [ ] SSL/TLS certificates configured
- [ ] Rate limiting enabled
- [ ] API documentation deployed

### Docker Deployment

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npx prisma generate

EXPOSE 3000

CMD ["npm", "run", "start:prod"]
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/cms
      - JWT_SECRET=${JWT_SECRET}
      - SMTP_HOST=${SMTP_HOST}
    depends_on:
      - db
      
  db:
    image: postgres:14
    environment:
      - POSTGRES_DB=cms
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

### Kubernetes Deployment

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cms-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: cms-backend
  template:
    metadata:
      labels:
        app: cms-backend
    spec:
      containers:
      - name: cms
        image: cms-backend:latest
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: cms-secrets
              key: database-url
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: cms-secrets
              key: jwt-secret
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
```

### Monitoring Recommendations

1. **Application Metrics**:
   - Request rate and latency
   - Error rate by endpoint
   - Database query performance
   - WebSocket connections count
   - Rule engine evaluation time

2. **Business Metrics**:
   - Tasks created per minute
   - Assignment success rate
   - SLA compliance rate
   - Average assignment time
   - Queue utilization

3. **Alerts**:
   - High error rate
   - Slow response times
   - SLA breach rate increase
   - Database connection exhaustion
   - Failed email notifications

---

## Support & Troubleshooting

### Common Issues

1. **Tasks Not Auto-Assigning**:
   - Check rule is active
   - Verify conditions match task attributes
   - Check rule priority order
   - Review audit logs for evaluation results

2. **SLA Checks Not Running**:
   - Verify cron is enabled
   - Check for mutex lock issues
   - Review service logs
   - Confirm database connectivity

3. **WebSocket Not Connecting**:
   - Verify JWT token validity
   - Check CORS configuration
   - Review network/firewall rules
   - Check WebSocket URL and namespace

4. **Notifications Not Sending**:
   - Verify SMTP configuration
   - Check email addresses
   - Review notification service logs
   - Test SMTP connection manually

### Debug Mode

Enable debug logging:

```bash
DEBUG=* npm run start:dev
```

### Log Files

```bash
# Application logs
tail -f logs/application.log

# Error logs
tail -f logs/error.log

# Audit logs (database)
SELECT * FROM audit_log ORDER BY performed_at DESC LIMIT 100;
```

---

## Additional Resources

- [ASSIGNMENT_RULES.md](./ASSIGNMENT_RULES.md) - Detailed rule documentation
- [REAL_TIME_MONITORING.md](./REAL_TIME_MONITORING.md) - WebSocket and SLA docs
- [API Swagger Documentation](http://localhost:3000/api) - Interactive API docs
- [Prisma Schema](./prisma/schema.prisma) - Database schema

---

## Changelog

### Version 1.0.0 (October 2025)

**Features**:
- ✅ Work Queue Management (CRUD)
- ✅ User Assignment (direct and role-based)
- ✅ Automated Assignment Rules Engine
- ✅ SLA Monitoring & Alerts
- ✅ Real-Time WebSocket Updates
- ✅ Email Notifications
- ✅ Supervisor Dashboard
- ✅ Comprehensive Audit Logging
- ✅ Multi-Tenancy Support
- ✅ Swagger API Documentation

**Database Migrations**:
- Added `work_queue` table
- Added `work_queue_role` table
- Added `work_queue_member` table
- Added `work_queue_assignment_rule` table
- Extended `task` table with queue support

**API Endpoints**: 22 endpoints implemented

**Documentation**: Complete API, testing, and deployment docs

---

**Last Updated**: October 18, 2025  
**Version**: 1.0.0  
**Authors**: Tazama Development Team
