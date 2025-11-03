# Work Queue ↔ Flowable Integration

## Overview

Work Queues are the **source of truth** for Flowable candidate groups and membership. This ensures consistent identity management and eliminates drift between the two systems.

## Event-Driven Architecture

### Work Queue Events → Flowable Actions

Work Queue Service emits enriched events that include `flowableGroupId` and other identity information. The Flowable Work Queue Listener consumes these events and reconciles identity in Flowable.

#### Event Flow

```
Work Queue Operation → Event Emission → Flowable Listener → Flowable API Call
```

## Event Contracts

### 1. `workQueue.created`
**Emitted**: When a new work queue is created
**Payload**:
```typescript
{
  workQueueId: string;
  name: string;
  tenantId: string;
  userId: string;
  flowableGroupId: string; // Format: tenant-<tenantId>__queue-<slug(name)>
}
```
**Flowable Action**: Creates the candidate group if it doesn't exist

### 2. `workQueue.updated`
**Emitted**: When a work queue is updated (especially name changes)
**Payload**:
```typescript
{
  workQueueId: string;
  tenantId: string;
  userId: string;
  changes: UpdateWorkQueueDto;
  name: string;
  flowableGroupId: string;
  oldFlowableGroupId?: string; // Present if name changed
}
```
**Flowable Action**: Ensures the new group exists (for renames)

### 3. `workQueue.sync` (Bootstrap Event)
**Emitted**: On application startup for each active work queue
**Payload**:
```typescript
{
  workQueueId: string;
  tenantId: string;
  name: string;
  isActive: boolean;
  flowableGroupId: string;
  members: string[]; // Array of user IDs
}
```
**Flowable Action**: Creates group if missing; adds all members to the group

### 4. `workQueue.userAssigned`
**Emitted**: When a user is assigned to a work queue
**Payload**:
```typescript
{
  workQueueId: string;
  userId: string;
  assignedBy: string;
  assignmentType: string;
  tenantId: string;
  workQueueName: string;
  flowableGroupId: string;
}
```
**Flowable Action**: Adds user to the Flowable candidate group

### 5. `workQueue.userRemoved`
**Emitted**: When a user is removed from a work queue
**Payload**:
```typescript
{
  workQueueId: string;
  userId: string;
  removedBy: string;
  tenantId: string;
  workQueueName: string;
  flowableGroupId: string;
}
```
**Flowable Action**: Removes user from the Flowable candidate group

### 6. `workQueue.deactivated` / `workQueue.deleted`
**Emitted**: When a work queue is deactivated or deleted
**Payload**:
```typescript
{
  workQueueId: string;
  tenantId: string;
  userId: string;
  flowableGroupId: string;
}
```
**Flowable Action**: Currently no action (groups are preserved for safety)

## Flowable Group ID Format

Canonical format: `tenant-<tenantId>__queue-<slug(name)>`

Where `slug(name)` is:
- Trimmed and lowercase
- Non-alphanumeric characters replaced with `-`
- Leading/trailing `-` removed
- Truncated to 50 characters

**Examples**:
- Work Queue: "Investigations Queue" → `tenant-12345__queue-investigations-queue`
- Work Queue: "High Priority Cases" → `tenant-12345__queue-high-priority-cases`

## Task Assignment Enhancement

When tasks are created, they are now automatically:
1. **Auto-assigned to work queues** based on `candidateGroup` matching
2. **candidateGroup updated** to use the derived `flowableGroupId`
3. **Events emitted** for work queue assignment tracking

This ensures tasks appear correctly in work queue interfaces and Flowable processes.

## Idempotency & Error Handling

All Flowable operations are designed to be idempotent:
- Group creation: 409 (already exists) is treated as success
- User membership: 409 (already member) is treated as success  
- User removal: 404 (not a member) is ignored
- Group lookup: 404 (doesn't exist) triggers creation

## Bootstrap Process

On application startup:
1. Work Queue Service enumerates all active work queues
2. For each queue, loads current members
3. Emits `workQueue.sync` event with complete state
4. Flowable listener ensures groups exist and membership is current

This provides eventual consistency and handles system restarts gracefully.

## Migration Notes

**Before**: Flowable initialized hard-coded candidate groups on startup
**After**: Work Queues drive all group creation and membership

The old `initializeCandidateGroups` method is disabled to prevent conflicts.