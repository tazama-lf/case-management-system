# Assignment Rules Documentation

## Overview

The Assignment Rules feature provides a sophisticated, condition-based system for automatically routing and assigning tasks to work queues and users. Rules use IF-THEN logic with multiple conditions, supporting complex boolean expressions (AND/OR), priority ordering, and conflict detection.

## Table of Contents

- [Concepts](#concepts)
- [Rule Structure](#rule-structure)
- [Trigger Types](#trigger-types)
- [Rule Attributes](#rule-attributes)
- [Operators](#operators)
- [Actions](#actions)
- [Priority and Stop-on-Match](#priority-and-stop-on-match)
- [API Reference](#api-reference)
- [Examples](#examples)
- [Frontend Integration](#frontend-integration)
- [Migration Guide](#migration-guide)

---

## Concepts

### What are Assignment Rules?

Assignment Rules are conditional logic statements that automatically route tasks based on task and case attributes. When a task is created, the system evaluates all active rules and applies the first matching rule (or multiple rules, depending on configuration).

### Key Features

1. **Conditional Logic**: Support for multiple conditions with AND/OR operators
2. **Rich Attribute Set**: 19 attributes covering task, case, user, and queue properties
3. **14 Comparison Operators**: From simple equality to complex pattern matching
4. **Priority Ordering**: Rules evaluated from highest to lowest priority (0-100)
5. **Stop-on-Match**: Option to stop evaluation after first match
6. **Conflict Detection**: Automatic detection of overlapping or conflicting rules
7. **Application Tracking**: Count and timestamp of rule applications
8. **Audit Trail**: Full logging of rule creation, updates, and applications

---

## Rule Structure

A complete assignment rule consists of:

```typescript
{
  "ruleName": "High Priority Investigations",
  "triggerType": "TASK_CREATED",
  "conditions": [
    {
      "attribute": "CASE_PRIORITY",
      "operator": "EQUALS",
      "value": "URGENT",
      "logicalOperator": "AND"
    },
    {
      "attribute": "TASK_TYPE",
      "operator": "EQUALS",
      "value": "INVESTIGATION"
    }
  ],
  "action": {
    "targetWorkQueueId": "uuid-of-high-priority-queue",
    "assignToUserId": "uuid-of-senior-investigator",
    "slaDurationHours": 4
  },
  "priorityOrder": 90,
  "stopOnMatch": true,
  "isActive": true
}
```

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ruleName` | string | Yes | Human-readable name (max 100 chars) |
| `triggerType` | enum | Yes | When to evaluate the rule |
| `conditions` | array | Yes | List of conditions (min 1) |
| `action` | object | Yes | What to do when conditions match |
| `priorityOrder` | number | No | Priority (0-100, default 50) |
| `stopOnMatch` | boolean | No | Stop after this rule matches (default false) |
| `isActive` | boolean | No | Whether rule is enabled (default true) |

---

## Trigger Types

Rules can be triggered at different points in the task lifecycle:

| Trigger | Value | Description |
|---------|-------|-------------|
| Task Created | `TASK_CREATED` | Evaluate when a new task is created |
| Task Updated | `TASK_UPDATED` | Evaluate when a task is modified (future) |
| Case Updated | `CASE_UPDATED` | Evaluate when the parent case changes (future) |
| Manual | `MANUAL` | Only evaluate when explicitly requested (future) |

**Currently Implemented:** `TASK_CREATED`

---

## Rule Attributes

Rules can evaluate against 19 different attributes:

### Task Attributes

| Attribute | Type | Description | Example Values |
|-----------|------|-------------|----------------|
| `TASK_ID` | string | Task identifier | `"uuid"` |
| `TASK_TYPE` | string | Type of task | `"INVESTIGATION"`, `"REVIEW"` |
| `TASK_STATUS` | string | Current task status | `"STATUS_01_UNASSIGNED"` |
| `TASK_NAME` | string | Task name/title | `"Investigate Transaction"` |
| `TASK_DESCRIPTION` | string | Task description | `"Review suspicious activity"` |
| `ASSIGNED_USER_ID` | string | Currently assigned user | `"uuid"` or `null` |
| `WORK_QUEUE_ID` | string | Current work queue | `"uuid"` or `null` |
| `CANDIDATE_GROUP` | string | Candidate group | `"Investigations"` |
| `CREATED_AT` | date | Task creation timestamp | ISO 8601 date |

### Case Attributes

| Attribute | Type | Description | Example Values |
|-----------|------|-------------|----------------|
| `CASE_ID` | string | Parent case identifier | `"uuid"` |
| `CASE_PRIORITY` | string | Case priority level | `"LOW"`, `"MEDIUM"`, `"HIGH"`, `"URGENT"` |
| `CASE_STATUS` | string | Case status | `"OPEN"`, `"IN_PROGRESS"` |
| `CASE_TYPE` | string | Type of case | `"FRAUD"`, `"AML"` |
| `CASE_RISK_SCORE` | number | Risk assessment score | `0-100` |

### Time Attributes

| Attribute | Type | Description | Example Values |
|-----------|------|-------------|----------------|
| `DAY_OF_WEEK` | string | Day task was created | `"MONDAY"`, `"FRIDAY"` |
| `HOUR_OF_DAY` | number | Hour task was created (24h) | `0-23` |
| `IS_WEEKEND` | boolean | Weekend flag | `true`, `false` |
| `IS_BUSINESS_HOURS` | boolean | Business hours flag (9am-5pm) | `true`, `false` |

---

## Operators

Rules support 14 comparison operators:

### String Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `EQUALS` | Exact match (case-sensitive) | `"URGENT" EQUALS "URGENT"` → true |
| `NOT_EQUALS` | Not equal | `"LOW" NOT_EQUALS "HIGH"` → true |
| `CONTAINS` | Substring match | `"Transaction Review" CONTAINS "Review"` → true |
| `NOT_CONTAINS` | Does not contain | `"Task Name" NOT_CONTAINS "xyz"` → true |
| `STARTS_WITH` | Prefix match | `"INV-123" STARTS_WITH "INV"` → true |
| `ENDS_WITH` | Suffix match | `"task.pdf" ENDS_WITH ".pdf"` → true |
| `IN` | Value in list | `"MEDIUM" IN ["LOW", "MEDIUM", "HIGH"]` → true |
| `NOT_IN` | Value not in list | `"URGENT" NOT_IN ["LOW", "MEDIUM"]` → true |

### Numeric Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `GREATER_THAN` | Numeric comparison | `85 GREATER_THAN 70` → true |
| `GREATER_THAN_OR_EQUAL` | ≥ comparison | `80 GREATER_THAN_OR_EQUAL 80` → true |
| `LESS_THAN` | Numeric comparison | `60 LESS_THAN 80` → true |
| `LESS_THAN_OR_EQUAL` | ≤ comparison | `50 LESS_THAN_OR_EQUAL 50` → true |

### Null Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `IS_NULL` | Value is null/undefined | `assigned_user_id IS_NULL` → true (unassigned) |
| `IS_NOT_NULL` | Value exists | `case_id IS_NOT_NULL` → true |

---

## Actions

When a rule matches, one or more actions are executed:

### Available Actions

```typescript
{
  "action": {
    "targetWorkQueueId": "uuid",      // Optional: Assign to work queue
    "assignToUserId": "uuid",          // Optional: Assign to specific user
    "slaDurationHours": 24             // Optional: Set SLA in hours
  }
}
```

### Action Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `targetWorkQueueId` | string (UUID) | No | Work queue to assign task to |
| `assignToUserId` | string (UUID) | No | User to assign task to |
| `slaDurationHours` | number | No | SLA duration (calculates deadline) |

**Note:** At least one action field must be specified.

### Action Behavior

- **Work Queue Assignment**: Updates `task.work_queue_id`
- **User Assignment**: Updates `task.assigned_user_id` and changes status to `STATUS_02_ASSIGNED`
- **SLA Duration**: Sets `task.sla_duration_hours` and calculates `task.sla_deadline`

---

## Priority and Stop-on-Match

### Priority Ordering

- Rules are evaluated from **highest to lowest** priority (100 → 0)
- Priority range: **0-100** (default: 50)
- Higher priority rules evaluated first
- Use priorities to create rule hierarchies

**Example Priority Strategy:**
```
Priority 100: Emergency/Critical rules
Priority 75-99: High priority business rules
Priority 50-74: Standard routing rules
Priority 25-49: Fallback rules
Priority 0-24: Default catch-all rules
```

### Stop-on-Match Behavior

- `stopOnMatch: true` - Stop evaluating after this rule matches
- `stopOnMatch: false` - Continue evaluating remaining rules

**Use Cases:**
- **Exclusive routing**: Set `stopOnMatch: true` for mutually exclusive rules
- **Cascading actions**: Set `stopOnMatch: false` to apply multiple rules

---

## API Reference

### Base URL
```
/api/v1/work-queues/:workQueueId/rules
```

### Authentication
All endpoints require:
- Valid JWT token in `Authorization: Bearer <token>` header
- `CMS_SUPERVISOR` role

---

### 1. Create Assignment Rule

Creates a new assignment rule for a work queue.

**Endpoint:** `POST /api/v1/work-queues/:workQueueId/rules`

**Request Body:**
```json
{
  "ruleName": "Route urgent fraud cases",
  "triggerType": "TASK_CREATED",
  "conditions": [
    {
      "attribute": "CASE_PRIORITY",
      "operator": "EQUALS",
      "value": "URGENT",
      "logicalOperator": "AND"
    },
    {
      "attribute": "CASE_TYPE",
      "operator": "EQUALS",
      "value": "FRAUD"
    }
  ],
  "action": {
    "targetWorkQueueId": "123e4567-e89b-12d3-a456-426614174000",
    "slaDurationHours": 4
  },
  "priorityOrder": 90,
  "stopOnMatch": true,
  "isActive": true
}
```

**Response:** `201 Created`
```json
{
  "ruleId": "rule-uuid",
  "workQueueId": "queue-uuid",
  "ruleName": "Route urgent fraud cases",
  "triggerType": "TASK_CREATED",
  "conditions": [...],
  "action": {...},
  "priorityOrder": 90,
  "stopOnMatch": true,
  "isActive": true,
  "applicationCount": 0,
  "lastAppliedAt": null,
  "createdAt": "2025-10-17T10:00:00Z",
  "updatedAt": "2025-10-17T10:00:00Z",
  "createdBy": "user-uuid",
  "updatedBy": null
}
```

**cURL Example:**
```bash
curl -X POST "https://api.example.com/api/v1/work-queues/queue-uuid/rules" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ruleName": "Route urgent fraud cases",
    "triggerType": "TASK_CREATED",
    "conditions": [
      {
        "attribute": "CASE_PRIORITY",
        "operator": "EQUALS",
        "value": "URGENT",
        "logicalOperator": "AND"
      },
      {
        "attribute": "CASE_TYPE",
        "operator": "EQUALS",
        "value": "FRAUD"
      }
    ],
    "action": {
      "targetWorkQueueId": "123e4567-e89b-12d3-a456-426614174000",
      "slaDurationHours": 4
    },
    "priorityOrder": 90,
    "stopOnMatch": true
  }'
```

---

### 2. List Assignment Rules

Retrieves all assignment rules for a work queue.

**Endpoint:** `GET /api/v1/work-queues/:workQueueId/rules`

**Query Parameters:**
- `activeOnly` (boolean, optional): Filter to active rules only

**Response:** `200 OK`
```json
[
  {
    "ruleId": "rule-uuid-1",
    "workQueueId": "queue-uuid",
    "ruleName": "High priority routing",
    "triggerType": "TASK_CREATED",
    "conditions": [...],
    "action": {...},
    "priorityOrder": 90,
    "stopOnMatch": true,
    "isActive": true,
    "applicationCount": 45,
    "lastAppliedAt": "2025-10-17T09:30:00Z",
    "createdAt": "2025-10-01T10:00:00Z",
    "updatedAt": "2025-10-15T14:20:00Z"
  }
]
```

**cURL Example:**
```bash
curl -X GET "https://api.example.com/api/v1/work-queues/queue-uuid/rules?activeOnly=true" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

### 3. Get Assignment Rule by ID

Retrieves details of a specific assignment rule.

**Endpoint:** `GET /api/v1/work-queues/:workQueueId/rules/:ruleId`

**Response:** `200 OK`
```json
{
  "ruleId": "rule-uuid",
  "workQueueId": "queue-uuid",
  "ruleName": "Route urgent fraud cases",
  "triggerType": "TASK_CREATED",
  "conditions": [...],
  "action": {...},
  "priorityOrder": 90,
  "stopOnMatch": true,
  "isActive": true,
  "applicationCount": 12,
  "lastAppliedAt": "2025-10-17T09:45:00Z",
  "createdAt": "2025-10-01T10:00:00Z",
  "updatedAt": "2025-10-15T14:20:00Z"
}
```

**cURL Example:**
```bash
curl -X GET "https://api.example.com/api/v1/work-queues/queue-uuid/rules/rule-uuid" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

### 4. Update Assignment Rule

Updates an existing assignment rule. All fields are optional.

**Endpoint:** `PUT /api/v1/work-queues/:workQueueId/rules/:ruleId`

**Request Body:**
```json
{
  "ruleName": "Updated rule name",
  "priorityOrder": 85,
  "isActive": false
}
```

**Response:** `200 OK`
```json
{
  "ruleId": "rule-uuid",
  "workQueueId": "queue-uuid",
  "ruleName": "Updated rule name",
  "priorityOrder": 85,
  "isActive": false,
  "updatedAt": "2025-10-17T10:30:00Z",
  "updatedBy": "user-uuid"
}
```

**cURL Example:**
```bash
curl -X PUT "https://api.example.com/api/v1/work-queues/queue-uuid/rules/rule-uuid" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "priorityOrder": 85,
    "isActive": false
  }'
```

---

### 5. Delete Assignment Rule

Deletes an assignment rule permanently.

**Endpoint:** `DELETE /api/v1/work-queues/work QueueId/rules/:ruleId`

**Response:** `204 No Content`

**cURL Example:**
```bash
curl -X DELETE "https://api.example.com/api/v1/work-queues/queue-uuid/rules/rule-uuid" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

### 6. Activate Assignment Rule

Activates a deactivated rule (sets `isActive: true`).

**Endpoint:** `POST /api/v1/work-queues/:workQueueId/rules/:ruleId/activate`

**Response:** `200 OK`
```json
{
  "ruleId": "rule-uuid",
  "isActive": true,
  "updatedAt": "2025-10-17T10:40:00Z"
}
```

**cURL Example:**
```bash
curl -X POST "https://api.example.com/api/v1/work-queues/queue-uuid/rules/rule-uuid/activate" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

### 7. Deactivate Assignment Rule

Deactivates a rule (sets `isActive: false`) without deleting it.

**Endpoint:** `POST /api/v1/work-queues/:workQueueId/rules/:ruleId/deactivate`

**Response:** `200 OK`
```json
{
  "ruleId": "rule-uuid",
  "isActive": false,
  "updatedAt": "2025-10-17T10:45:00Z"
}
```

**cURL Example:**
```bash
curl -X POST "https://api.example.com/api/v1/work-queues/queue-uuid/rules/rule-uuid/deactivate" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Examples

### Example 1: Route Urgent Cases to Senior Investigators

**Business Rule:** All urgent fraud cases should be assigned to the senior fraud team queue with a 4-hour SLA.

```json
{
  "ruleName": "Urgent Fraud - Senior Team",
  "triggerType": "TASK_CREATED",
  "conditions": [
    {
      "attribute": "CASE_PRIORITY",
      "operator": "EQUALS",
      "value": "URGENT",
      "logicalOperator": "AND"
    },
    {
      "attribute": "CASE_TYPE",
      "operator": "EQUALS",
      "value": "FRAUD"
    }
  ],
  "action": {
    "targetWorkQueueId": "senior-fraud-queue-uuid",
    "slaDurationHours": 4
  },
  "priorityOrder": 95,
  "stopOnMatch": true,
  "isActive": true
}
```

---

### Example 2: Weekday vs Weekend Routing

**Business Rule:** Route all tasks created on weekends to the on-call queue.

```json
{
  "ruleName": "Weekend On-Call Routing",
  "triggerType": "TASK_CREATED",
  "conditions": [
    {
      "attribute": "IS_WEEKEND",
      "operator": "EQUALS",
      "value": true
    }
  ],
  "action": {
    "targetWorkQueueId": "on-call-queue-uuid",
    "slaDurationHours": 48
  },
  "priorityOrder": 80,
  "stopOnMatch": false,
  "isActive": true
}
```

---

### Example 3: High Risk Score Auto-Assignment

**Business Rule:** Cases with risk scores above 80 should be immediately assigned to the risk assessment team.

```json
{
  "ruleName": "High Risk Score Assignment",
  "triggerType": "TASK_CREATED",
  "conditions": [
    {
      "attribute": "CASE_RISK_SCORE",
      "operator": "GREATER_THAN",
      "value": 80
    }
  ],
  "action": {
    "targetWorkQueueId": "risk-assessment-queue-uuid",
    "assignToUserId": "lead-analyst-uuid",
    "slaDurationHours": 2
  },
  "priorityOrder": 90,
  "stopOnMatch": true,
  "isActive": true
}
```

---

### Example 4: Multiple Case Types Routing

**Business Rule:** Route AML or fraud cases to the compliance queue.

```json
{
  "ruleName": "Compliance Cases Routing",
  "triggerType": "TASK_CREATED",
  "conditions": [
    {
      "attribute": "CASE_TYPE",
      "operator": "IN",
      "value": ["AML", "FRAUD", "SANCTIONS"]
    }
  ],
  "action": {
    "targetWorkQueueId": "compliance-queue-uuid",
    "slaDurationHours": 24
  },
  "priorityOrder": 70,
  "stopOnMatch": false,
  "isActive": true
}
```

---

### Example 5: Business Hours Prioritization

**Business Rule:** Tasks created during business hours (9am-5pm) get standard SLA, after hours get extended SLA.

```json
{
  "ruleName": "After Hours Extended SLA",
  "triggerType": "TASK_CREATED",
  "conditions": [
    {
      "attribute": "IS_BUSINESS_HOURS",
      "operator": "EQUALS",
      "value": false
    }
  ],
  "action": {
    "slaDurationHours": 48
  },
  "priorityOrder": 60,
  "stopOnMatch": false,
  "isActive": true
}
```

---

### Example 6: Complex AND/OR Logic

**Business Rule:** Route high or urgent priority cases that are either fraud OR AML related to the specialized team.

```json
{
  "ruleName": "High Priority Fraud/AML",
  "triggerType": "TASK_CREATED",
  "conditions": [
    {
      "attribute": "CASE_PRIORITY",
      "operator": "IN",
      "value": ["HIGH", "URGENT"],
      "logicalOperator": "AND"
    },
    {
      "attribute": "CASE_TYPE",
      "operator": "IN",
      "value": ["FRAUD", "AML"]
    }
  ],
  "action": {
    "targetWorkQueueId": "specialized-queue-uuid",
    "slaDurationHours": 8
  },
  "priorityOrder": 85,
  "stopOnMatch": true,
  "isActive": true
}
```

---

### Example 7: Unassigned Tasks Catch-All

**Business Rule:** Default routing for any unassigned tasks to general investigations queue.

```json
{
  "ruleName": "Default Routing - Unassigned",
  "triggerType": "TASK_CREATED",
  "conditions": [
    {
      "attribute": "ASSIGNED_USER_ID",
      "operator": "IS_NULL",
      "value": null
    }
  ],
  "action": {
    "targetWorkQueueId": "general-queue-uuid",
    "slaDurationHours": 72
  },
  "priorityOrder": 10,
  "stopOnMatch": false,
  "isActive": true
}
```

---

## Frontend Integration

### React Component Example

```typescript
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';

interface RuleFormData {
  ruleName: string;
  triggerType: string;
  conditions: Array<{
    attribute: string;
    operator: string;
    value: any;
    logicalOperator?: string;
  }>;
  action: {
    targetWorkQueueId?: string;
    assignToUserId?: string;
    slaDurationHours?: number;
  };
  priorityOrder: number;
  stopOnMatch: boolean;
}

export const AssignmentRuleForm: React.FC<{ workQueueId: string }> = ({ workQueueId }) => {
  const { register, handleSubmit, watch } = useForm<RuleFormData>();
  const [conditions, setConditions] = useState([{ attribute: '', operator: '', value: '' }]);

  const onSubmit = async (data: RuleFormData) => {
    try {
      const response = await fetch(`/api/v1/work-queues/${workQueueId}/rules`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        alert('Rule created successfully!');
      } else {
        const error = await response.json();
        alert(`Error: ${error.message}`);
      }
    } catch (error) {
      console.error('Failed to create rule:', error);
    }
  };

  const addCondition = () => {
    setConditions([...conditions, { attribute: '', operator: '', value: '' }]);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div>
        <label>Rule Name:</label>
        <input {...register('ruleName', { required: true })} />
      </div>

      <div>
        <label>Trigger Type:</label>
        <select {...register('triggerType')}>
          <option value="TASK_CREATED">Task Created</option>
          <option value="TASK_UPDATED">Task Updated</option>
        </select>
      </div>

      <div>
        <h3>Conditions</h3>
        {conditions.map((_, index) => (
          <div key={index}>
            <select {...register(`conditions.${index}.attribute`)}>
              <option value="CASE_PRIORITY">Case Priority</option>
              <option value="TASK_TYPE">Task Type</option>
              <option value="CASE_TYPE">Case Type</option>
              {/* Add more attributes */}
            </select>

            <select {...register(`conditions.${index}.operator`)}>
              <option value="EQUALS">Equals</option>
              <option value="NOT_EQUALS">Not Equals</option>
              <option value="IN">In List</option>
              {/* Add more operators */}
            </select>

            <input {...register(`conditions.${index}.value`)} placeholder="Value" />

            {index < conditions.length - 1 && (
              <select {...register(`conditions.${index}.logicalOperator`)}>
                <option value="AND">AND</option>
                <option value="OR">OR</option>
              </select>
            )}
          </div>
        ))}
        <button type="button" onClick={addCondition}>Add Condition</button>
      </div>

      <div>
        <h3>Action</h3>
        <input {...register('action.targetWorkQueueId')} placeholder="Target Queue ID" />
        <input {...register('action.assignToUserId')} placeholder="Assign To User ID" />
        <input type="number" {...register('action.slaDurationHours')} placeholder="SLA Hours" />
      </div>

      <div>
        <label>Priority Order (0-100):</label>
        <input type="number" {...register('priorityOrder')} defaultValue={50} min={0} max={100} />
      </div>

      <div>
        <label>
          <input type="checkbox" {...register('stopOnMatch')} />
          Stop on Match
        </label>
      </div>

      <button type="submit">Create Rule</button>
    </form>
  );
};
```

---

### Vue 3 Component Example

```vue
<template>
  <form @submit.prevent="submitRule">
    <div>
      <label>Rule Name:</label>
      <input v-model="ruleForm.ruleName" required />
    </div>

    <div>
      <label>Trigger Type:</label>
      <select v-model="ruleForm.triggerType">
        <option value="TASK_CREATED">Task Created</option>
        <option value="TASK_UPDATED">Task Updated</option>
      </select>
    </div>

    <div>
      <h3>Conditions</h3>
      <div v-for="(condition, index) in ruleForm.conditions" :key="index">
        <select v-model="condition.attribute">
          <option value="CASE_PRIORITY">Case Priority</option>
          <option value="TASK_TYPE">Task Type</option>
          <!-- Add more options -->
        </select>

        <select v-model="condition.operator">
          <option value="EQUALS">Equals</option>
          <option value="NOT_EQUALS">Not Equals</option>
          <!-- Add more options -->
        </select>

        <input v-model="condition.value" placeholder="Value" />

        <select v-if="index < ruleForm.conditions.length - 1" v-model="condition.logicalOperator">
          <option value="AND">AND</option>
          <option value="OR">OR</option>
        </select>
      </div>
      <button type="button" @click="addCondition">Add Condition</button>
    </div>

    <div>
      <h3>Action</h3>
      <input v-model="ruleForm.action.targetWorkQueueId" placeholder="Target Queue ID" />
      <input v-model="ruleForm.action.assignToUserId" placeholder="Assign To User ID" />
      <input v-model.number="ruleForm.action.slaDurationHours" type="number" placeholder="SLA Hours" />
    </div>

    <div>
      <label>Priority Order (0-100):</label>
      <input v-model.number="ruleForm.priorityOrder" type="number" min="0" max="100" />
    </div>

    <div>
      <label>
        <input v-model="ruleForm.stopOnMatch" type="checkbox" />
        Stop on Match
      </label>
    </div>

    <button type="submit">Create Rule</button>
  </form>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import axios from 'axios';

const props = defineProps<{ workQueueId: string }>();

const ruleForm = ref({
  ruleName: '',
  triggerType: 'TASK_CREATED',
  conditions: [{ attribute: '', operator: '', value: '', logicalOperator: 'AND' }],
  action: {
    targetWorkQueueId: '',
    assignToUserId: '',
    slaDurationHours: null,
  },
  priorityOrder: 50,
  stopOnMatch: false,
});

const addCondition = () => {
  ruleForm.value.conditions.push({ attribute: '', operator: '', value: '', logicalOperator: 'AND' });
};

const submitRule = async () => {
  try {
    const response = await axios.post(
      `/api/v1/work-queues/${props.workQueueId}/rules`,
      ruleForm.value,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      }
    );
    alert('Rule created successfully!');
    console.log(response.data);
  } catch (error) {
    console.error('Failed to create rule:', error);
    alert('Error creating rule');
  }
};
</script>
```

---

## Migration Guide

### Migrating from Simple Rules to Conditional Rules

#### Old Format (Deprecated)

```typescript
{
  "ruleType": "PRIORITY_BASED", // enum
  "ruleConfig": {
    "priority": "HIGH",
    "targetQueueId": "queue-uuid"
  }
}
```

#### New Format

```typescript
{
  "ruleName": "High Priority Cases",
  "triggerType": "TASK_CREATED",
  "conditions": [
    {
      "attribute": "CASE_PRIORITY",
      "operator": "EQUALS",
      "value": "HIGH"
    }
  ],
  "action": {
    "targetWorkQueueId": "queue-uuid"
  },
  "priorityOrder": 75,
  "stopOnMatch": true
}
```

### Migration Steps

1. **Audit Existing Rules**: Export all existing simple rules
2. **Map to Conditional Format**: Convert each simple rule to conditional structure
3. **Test in Development**: Create and test new rules in dev environment
4. **Parallel Run**: Keep old rules active while testing new rules
5. **Switch Over**: Deactivate old rules, activate new rules
6. **Monitor**: Watch audit logs and application metrics
7. **Cleanup**: Delete old rules after validation period

### Backward Compatibility

- Old `rule_type` and `rule_config` fields are **retained** in the database schema
- System prioritizes new conditional fields (`trigger_type`, `conditions`, `actions`)
- Legacy rules continue to work but cannot leverage new features
- Recommend migrating all rules within 3-6 months

---

## Best Practices

### 1. Naming Conventions

- Use descriptive, actionable names: "Route Urgent Fraud to Senior Team"
- Include priority level in name for clarity: "P90 - High Risk Auto-Assign"
- Use consistent naming patterns across your organization

### 2. Priority Strategy

- Reserve 90-100 for emergency/critical routing
- Use 70-89 for standard business logic
- Use 50-69 for secondary routing rules
- Use 0-49 for fallback/default rules

### 3. Testing Rules

- Test rules with `testRule()` API before activating
- Use low-priority test rules in production initially
- Monitor `applicationCount` and `lastAppliedAt` metrics
- Review audit logs regularly

### 4. Performance

- Keep condition counts reasonable (< 10 conditions per rule)
- Use `IN` operator instead of multiple `EQUALS` with OR
- Set `stopOnMatch: true` for exclusive routing scenarios
- Regularly review and deactivate unused rules

### 5. Maintenance

- Document business logic behind each rule
- Review rules quarterly for relevance
- Track rule effectiveness through application metrics
- Version control rule configurations

---

## Troubleshooting

### Rule Not Applying

**Symptoms:** Task created but rule didn't execute

**Checklist:**
1. Is rule `isActive: true`?
2. Does rule `triggerType` match the event?
3. Do conditions match task/case attributes exactly?
4. Is there a higher priority rule with `stopOnMatch: true`?
5. Check audit logs for RULE_APPLIED events

### Conflicting Rules

**Symptoms:** Unexpected task routing or assignments

**Actions:**
1. Review all active rules sorted by priority
2. Check for overlapping conditions
3. Use conflict detection: `checkRuleConflicts()` API
4. Verify `stopOnMatch` settings
5. Examine `lastAppliedAt` timestamps to identify active rules

### Performance Issues

**Symptoms:** Slow task creation

**Solutions:**
1. Reduce total number of active rules
2. Simplify condition logic
3. Use `stopOnMatch: true` more frequently
4. Index commonly queried attributes
5. Monitor rule evaluation time in logs

---

## Support

For issues or questions:
- **Documentation**: [Link to internal wiki]
- **Support Team**: cms-support@example.com
- **Slack Channel**: #cms-assignment-rules

---

## Appendix

### Complete Type Definitions

```typescript
enum RuleTrigger {
  TASK_CREATED = 'TASK_CREATED',
  TASK_UPDATED = 'TASK_UPDATED',
  CASE_UPDATED = 'CASE_UPDATED',
  MANUAL = 'MANUAL',
}

enum RuleAttribute {
  // Task attributes
  TASK_ID = 'TASK_ID',
  TASK_TYPE = 'TASK_TYPE',
  TASK_STATUS = 'TASK_STATUS',
  TASK_NAME = 'TASK_NAME',
  TASK_DESCRIPTION = 'TASK_DESCRIPTION',
  ASSIGNED_USER_ID = 'ASSIGNED_USER_ID',
  WORK_QUEUE_ID = 'WORK_QUEUE_ID',
  CANDIDATE_GROUP = 'CANDIDATE_GROUP',
  CREATED_AT = 'CREATED_AT',
  
  // Case attributes
  CASE_ID = 'CASE_ID',
  CASE_PRIORITY = 'CASE_PRIORITY',
  CASE_STATUS = 'CASE_STATUS',
  CASE_TYPE = 'CASE_TYPE',
  CASE_RISK_SCORE = 'CASE_RISK_SCORE',
  
  // Time-based attributes
  DAY_OF_WEEK = 'DAY_OF_WEEK',
  HOUR_OF_DAY = 'HOUR_OF_DAY',
  IS_WEEKEND = 'IS_WEEKEND',
  IS_BUSINESS_HOURS = 'IS_BUSINESS_HOURS',
}

enum RuleOperator {
  EQUALS = 'EQUALS',
  NOT_EQUALS = 'NOT_EQUALS',
  CONTAINS = 'CONTAINS',
  NOT_CONTAINS = 'NOT_CONTAINS',
  STARTS_WITH = 'STARTS_WITH',
  ENDS_WITH = 'ENDS_WITH',
  IN = 'IN',
  NOT_IN = 'NOT_IN',
  GREATER_THAN = 'GREATER_THAN',
  GREATER_THAN_OR_EQUAL = 'GREATER_THAN_OR_EQUAL',
  LESS_THAN = 'LESS_THAN',
  LESS_THAN_OR_EQUAL = 'LESS_THAN_OR_EQUAL',
  IS_NULL = 'IS_NULL',
  IS_NOT_NULL = 'IS_NOT_NULL',
}

enum LogicalOperator {
  AND = 'AND',
  OR = 'OR',
}

interface RuleConditionDto {
  attribute: RuleAttribute;
  operator: RuleOperator;
  value: any;
  logicalOperator?: LogicalOperator;
}

interface RuleActionDto {
  targetWorkQueueId?: string;
  assignToUserId?: string;
  slaDurationHours?: number;
}

interface CreateAssignmentRuleDto {
  ruleName: string;
  triggerType: RuleTrigger;
  conditions: RuleConditionDto[];
  action: RuleActionDto;
  priorityOrder?: number;
  stopOnMatch?: boolean;
  isActive?: boolean;
}
```

---

**Version:** 1.0  
**Last Updated:** October 17, 2025  
**Authors:** Tazama Engineering Team
