# Manual Testing Guide - Notification System with Swagger

## Overview

This guide walks you through manually testing the complete notification system using Swagger UI, including:
- ✅ User notification preferences
- ✅ Email notifications via user lookup
- ✅ Task assignment notifications
- ✅ Notification logging and history
- ✅ Retry mechanism
- ✅ In-app notifications via WebSocket

**Estimated Time**: 30-45 minutes  
**Prerequisites**: Backend server running, Swagger UI accessible

---

## Prerequisites Setup

### 1. Start the Backend Server

```bash
cd /Users/mayhem/Projects/Tazama/case-management-system/backend

# Install dependencies (if not done)
npm install

# Start the server
npm run start:dev
```

**Expected Output**:
```
[Nest] LOG [NestApplication] Nest application successfully started
[Nest] LOG [NotificationRetryService] Processing notification retry queue...
```

### 2. Access Swagger UI

Open your browser and navigate to:
```
http://localhost:3000/api
```

You should see the Swagger UI with all API endpoints organized by controllers.

### 3. Get Authentication Token

**Option A - Login via Swagger**:
1. Find the **`POST /api/v1/auth/login`** endpoint
2. Click "Try it out"
3. Enter credentials:
   ```json
   {
     "username": "test-user",
     "password": "abc.123"
   }
   ```
4. Click "Execute"
5. Copy the `token` from the response

**Option B - Login via Terminal**:
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test-user","password":"abc.123"}'
```

**Expected Response**:
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 3600
}
```

### 4. Authorize in Swagger

1. Click the **"Authorize"** button (lock icon) at the top right
2. Enter: `Bearer <your-token-here>`
3. Click "Authorize"
4. Click "Close"

✅ You're now authenticated for all requests!

---

## Test Suite

---

## 🧪 Test 1: Check User Email Lookup

**Purpose**: Verify that UserService can retrieve real user emails

### Step 1.1: Get Your User Info
**Endpoint**: `GET /api/v1/auth/me`

1. Find the **Auth** section in Swagger
2. Locate **`GET /api/v1/auth/me`**
3. Click "Try it out"
4. Click "Execute"

**Expected Response**:
```json
{
  "token": {
    "clientId": "user-id-here",
    "tenantId": "tenant-id-here",
    "claims": ["CMS-TEST-ROLE"]
  },
  "validClaims": ["CMS-TEST-ROLE"]
}
```

📝 **Note down the `clientId`** - this is your user ID for the next steps.

### Step 1.2: Verify User Exists in Mock Data

Check if your user ID matches one of the mock users in `AuthHelperService`:

**Known Mock Users**:
| User ID | Name | Email | Role |
|---------|------|-------|------|
| `b29bda5d-f8b4-4a5d-8f12-5b6d6027cf90` | Alice Mwangi | alice.mwangi@cms.org | Supervisor |
| `f8a2c016-2b8d-41da-bbb9-41ad3c26dfc2` | Brian Otieno | brian.otieno@cms.org | Supervisor |
| `c3c23b1d-ff1c-4922-9f16-89e6d5f334bb` | Felix Mutiso | felix.mutiso@cms.org | Analyst |
| `e0ff568c-b2a8-4b46-88f9-96a89952c3ef` | Grace Otieno | grace.otieno@cms.org | Analyst |
| `c98db341-beb6-457c-98e0-406cc1c71662` | Karen Mworia | karen.mworia@cms.org | Investigator |

💡 **Tip**: If your user ID doesn't match, you can use one of these IDs for testing task assignments in later steps.

---

## 🧪 Test 2: Notification Preferences

**Purpose**: Manage user notification preferences

### Step 2.1: Get Current Preferences
**Endpoint**: `GET /api/v1/users/me/notification-preferences`

1. Find **NotificationPreferences** section
2. Locate **`GET /api/v1/users/me/notification-preferences`**
3. Click "Try it out"
4. Click "Execute"

**Expected Response** (first time - auto-created defaults):
```json
{
  "user_id": "your-user-id",
  "tenant_id": "your-tenant-id",
  "email_enabled": true,
  "in_app_enabled": true,
  "sms_enabled": false,
  "dashboard_enabled": true,
  "phone_number": null,
  "default_channel": "EMAIL",
  "suppress_task_assigned": false,
  "suppress_task_reassigned": false,
  "suppress_task_unassigned": false,
  "suppress_sla_warning": false,
  "suppress_sla_breach": false,
  "created_at": "2025-10-18T10:00:00.000Z",
  "updated_at": "2025-10-18T10:00:00.000Z"
}
```

✅ **Success**: Preferences auto-created with defaults

### Step 2.2: Update Preferences
**Endpoint**: `PUT /api/v1/users/me/notification-preferences`

1. Locate **`PUT /api/v1/users/me/notification-preferences`**
2. Click "Try it out"
3. Modify the request body:
   ```json
   {
     "email_enabled": true,
     "in_app_enabled": true,
     "sms_enabled": false,
     "dashboard_enabled": true,
     "default_channel": "EMAIL",
     "suppress_task_assigned": false,
     "suppress_task_reassigned": false
   }
   ```
4. Click "Execute"

**Expected Response**:
```json
{
  "user_id": "your-user-id",
  "email_enabled": true,
  "in_app_enabled": true,
  // ... updated preferences
}
```

✅ **Success**: Preferences updated

### Step 2.3: Test Validation - Try Invalid Data
**Endpoint**: `PUT /api/v1/users/me/notification-preferences`

1. Try disabling all channels:
   ```json
   {
     "email_enabled": false,
     "in_app_enabled": false,
     "sms_enabled": false,
     "dashboard_enabled": false
   }
   ```
2. Click "Execute"

**Expected Response** (400 Bad Request):
```json
{
  "statusCode": 400,
  "message": "At least one notification channel must be enabled",
  "error": "Bad Request"
}
```

✅ **Success**: Validation working correctly

---

## 🧪 Test 3: Send Test Notification

**Purpose**: Test email delivery with real user lookup

### Step 3.1: Send Test Email
**Endpoint**: `POST /api/v1/users/me/notification-preferences/test`

1. Locate **`POST /api/v1/users/me/notification-preferences/test`**
2. Click "Try it out"
3. Use the request body:
   ```json
   {
     "channel": "EMAIL"
   }
   ```
4. Click "Execute"

**Expected Response**:
```json
{
  "message": "Test notification sent successfully",
  "channel": "EMAIL",
  "recipient": "alice.mwangi@cms.org"
}
```

### Step 3.2: Check Backend Logs

Open your terminal where the backend is running and look for:

```
[NotificationService] Dispatching GENERIC notification for user b29bda5d-f8b4-4a5d-8f12-5b6d6027cf90
[UserService] Getting email for user b29bda5d-f8b4-4a5d-8f12-5b6d6027cf90
[NotificationService] Email sent successfully to alice.mwangi@cms.org
```

✅ **Success**: Email sent to **real email address** (not placeholder!)

### Step 3.3: Check Email (if SMTP configured)

If you have SMTP configured:
1. Check the inbox for `alice.mwangi@cms.org` (or your configured email)
2. Look for subject: "Test Notification"
3. Email should have proper formatting

💡 **Note**: If SMTP not configured, check logs for "Email would be sent to..." message

---

## 🧪 Test 4: Task Assignment Notification

**Purpose**: Test task assignment triggers email with user lookup

### Step 4.1: Create a Case (if needed)

**Endpoint**: `POST /api/v1/case`

1. Find **Case** section
2. Locate **`POST /api/v1/case`**
3. Click "Try it out"
4. Request body:
   ```json
   {
     "alert_id": "test-alert-123",
     "case_priority": "HIGH"
   }
   ```
5. Click "Execute"

**Expected Response**:
```json
{
  "case_id": "some-uuid",
  "alert_id": "test-alert-123",
  "case_priority": "HIGH",
  "case_status": "OPEN",
  // ... other fields
}
```

📝 **Note down the `case_id`**

### Step 4.2: Create a Work Queue (if needed)

**Endpoint**: `POST /api/v1/work-queues`

1. Find **WorkQueue** section
2. Locate **`POST /api/v1/work-queues`**
3. Click "Try it out"
4. Request body:
   ```json
   {
     "name": "Test Queue",
     "description": "Queue for testing notifications",
     "is_active": true,
     "assignment_strategy": "MANUAL",
     "allowed_task_types": ["INVESTIGATION", "REVIEW"]
   }
   ```
5. Click "Execute"

📝 **Note down the `work_queue_id`**

### Step 4.3: Create and Assign a Task

**Endpoint**: `POST /api/v1/tasks`

1. Find **Task** section
2. Locate **`POST /api/v1/tasks`**
3. Click "Try it out"
4. Request body (use a **known user ID** from the mock users):
   ```json
   {
     "case_id": "your-case-id-from-4.1",
     "task_name": "Test Task Assignment Notification",
     "task_type": "INVESTIGATION",
     "task_description": "Testing notification system with user lookup",
     "assigned_user_id": "b29bda5d-f8b4-4a5d-8f12-5b6d6027cf90",
     "work_queue_id": "your-work-queue-id-from-4.2",
     "task_priority": "HIGH"
   }
   ```
5. Click "Execute"

**Expected Response**:
```json
{
  "task_id": "some-uuid",
  "task_name": "Test Task Assignment Notification",
  "assigned_user_id": "b29bda5d-f8b4-4a5d-8f12-5b6d6027cf90",
  // ... other fields
}
```

### Step 4.4: Check Backend Logs for Notification

Look for these logs:

```
[NotificationService] Task Assigned: Task some-uuid assigned to user b29bda5d-f8b4-4a5d-8f12-5b6d6027cf90
[UserService] Getting email for user b29bda5d-f8b4-4a5d-8f12-5b6d6027cf90
[NotificationService] Email sent successfully to alice.mwangi@cms.org
[NotificationLogService] Created notification log for user b29bda5d-f8b4-4a5d-8f12-5b6d6027cf90
```

✅ **Success**: 
- Event triggered: `task.assigned`
- User lookup successful: `alice.mwangi@cms.org`
- Email sent to real address
- Notification logged

---

## 🧪 Test 5: Check Notification History

**Purpose**: Verify notification logging system

### Step 5.1: Get Notification History
**Endpoint**: `GET /api/v1/users/me/notification-preferences/history`

1. Locate **`GET /api/v1/users/me/notification-preferences/history`**
2. Click "Try it out"
3. Set query parameters:
   - `page`: 1
   - `limit`: 10
   - `channel`: EMAIL (optional)
   - `delivery_status`: SENT (optional)
4. Click "Execute"

**Expected Response**:
```json
{
  "notifications": [
    {
      "notification_log_id": "uuid",
      "user_id": "your-user-id",
      "notification_type": "TASK_ASSIGNED",
      "channel": "EMAIL",
      "delivery_status": "SENT",
      "subject": "New Task Assigned: Test Task Assignment Notification",
      "message": "A new task has been assigned to you...",
      "payload": {
        "taskTitle": "Test Task Assignment Notification",
        "taskType": "INVESTIGATION",
        "priority": "HIGH"
      },
      "retry_count": 0,
      "sent_at": "2025-10-18T10:15:00.000Z",
      "created_at": "2025-10-18T10:15:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1
  }
}
```

✅ **Success**: Complete audit trail of notifications

### Step 5.2: Filter by Status

Try different filters:

**Get Failed Notifications**:
- `delivery_status`: FAILED

**Get Pending Notifications**:
- `delivery_status`: PENDING

**Get Notifications by Type**:
- `notification_type`: TASK_ASSIGNED

---

## 🧪 Test 6: Task Reassignment Notification

**Purpose**: Test reassignment sends emails to both old and new assignee

### Step 6.1: Reassign the Task

**Endpoint**: `PATCH /api/v1/tasks/{taskId}`

1. Find **Task** section
2. Locate **`PATCH /api/v1/tasks/{taskId}`**
3. Click "Try it out"
4. Enter `taskId` from Test 4.3
5. Request body (reassign to different user):
   ```json
   {
     "assigned_user_id": "f8a2c016-2b8d-41da-bbb9-41ad3c26dfc2"
   }
   ```
   (This reassigns from Alice to Brian)
6. Click "Execute"

**Expected Response**:
```json
{
  "task_id": "uuid",
  "assigned_user_id": "f8a2c016-2b8d-41da-bbb9-41ad3c26dfc2",
  // ... updated fields
}
```

### Step 6.2: Check Backend Logs

Look for TWO email notifications:

```
[NotificationService] Task Reassigned: Task xxx reassigned from b29bda5d-... to f8a2c016-...

# Email 1 - New Assignee
[UserService] Getting email for user f8a2c016-2b8d-41da-bbb9-41ad3c26dfc2
[NotificationService] Email sent to brian.otieno@cms.org (new assignee)

# Email 2 - Previous Assignee  
[UserService] Getting email for user b29bda5d-f8b4-4a5d-8f12-5b6d6027cf90
[NotificationService] Email sent to alice.mwangi@cms.org (previous assignee)
```

✅ **Success**: Both users notified with real email addresses

---

## 🧪 Test 7: Notification Retry Mechanism

**Purpose**: Test automatic retry for failed notifications

### Step 7.1: Simulate a Failed Notification

**Option A - Via Database** (requires direct DB access):
```sql
-- Update a notification to FAILED status
UPDATE notification_logs 
SET delivery_status = 'FAILED',
    error_message = 'Simulated failure for testing',
    retry_count = 0
WHERE notification_log_id = 'your-notification-id';
```

**Option B - Temporarily Break SMTP**:
1. Stop the backend
2. Edit `.env` to use invalid SMTP credentials:
   ```bash
   SMTP_HOST=invalid.smtp.com
   SMTP_PORT=587
   SMTP_USER=invalid@user.com
   SMTP_PASS=wrongpassword
   ```
3. Restart backend
4. Trigger a task assignment (Test 4.3)
5. Notification will fail and be marked FAILED

### Step 7.2: Restore SMTP and Wait for Retry

1. Fix SMTP credentials in `.env`
2. Restart backend
3. Wait 5 minutes (retry cron job runs every 5 minutes)

### Step 7.3: Check Retry Logs

After 5 minutes, look for:

```
[NotificationRetryService] Processing notification retry queue...
[NotificationRetryService] Found 1 failed notifications to retry
[NotificationRetryService] Retrying notification xxx (attempt 1/5)
[UserService] Getting email for user b29bda5d-...
[NotificationRetryService] Notification xxx successfully resent on retry 1
[NotificationLogService] Updated delivery status to SENT
```

### Step 7.4: Check Notification History

**Endpoint**: `GET /api/v1/users/me/notification-preferences/history`

Look for the notification with:
- `delivery_status`: "SENT"
- `retry_count`: 1
- `sent_at`: Updated timestamp

✅ **Success**: Retry mechanism working with user lookup

---

## 🧪 Test 8: Suppression Settings

**Purpose**: Test notification suppression

### Step 8.1: Suppress Task Assignments

**Endpoint**: `PUT /api/v1/users/me/notification-preferences`

1. Update preferences:
   ```json
   {
     "email_enabled": true,
     "suppress_task_assigned": true
   }
   ```
2. Click "Execute"

### Step 8.2: Assign a New Task

**Endpoint**: `POST /api/v1/tasks`

Create another task assignment (same as Test 4.3)

### Step 8.3: Check Logs

Look for:
```
[NotificationPreferencesService] Checking if user should receive TASK_ASSIGNED notification
[NotificationPreferencesService] Notification suppressed for user (type: TASK_ASSIGNED)
[NotificationService] NOT sending notification - suppressed by user preferences
```

✅ **Success**: Suppression working (no email sent)

### Step 8.4: Verify in History

**Endpoint**: `GET /api/v1/users/me/notification-preferences/history`

The suppressed notification should either:
- Not appear at all (not created)
- OR appear with status "SUPPRESSED"

---

## 🧪 Test 9: Multiple Notification Channels

**Purpose**: Test in-app and dashboard notifications

### Step 9.1: Enable All Channels

**Endpoint**: `PUT /api/v1/users/me/notification-preferences`

```json
{
  "email_enabled": true,
  "in_app_enabled": true,
  "dashboard_enabled": true,
  "default_channel": "IN_APP"
}
```

### Step 9.2: Create Task Assignment

Assign a new task (Test 4.3)

### Step 9.3: Check Notification Logs

**Endpoint**: `GET /api/v1/users/me/notification-preferences/history`

Look for multiple entries with different channels:
```json
{
  "notifications": [
    {
      "channel": "EMAIL",
      "delivery_status": "SENT"
    },
    {
      "channel": "IN_APP",
      "delivery_status": "SENT"
    },
    {
      "channel": "DASHBOARD",
      "delivery_status": "SENT"
    }
  ]
}
```

✅ **Success**: Multi-channel delivery working

---

## 🧪 Test 10: User Lookup Fallback

**Purpose**: Test fallback when user not found

### Step 10.1: Assign to Unknown User

**Endpoint**: `POST /api/v1/tasks`

Try to assign a task to a **non-existent user ID**:
```json
{
  "case_id": "your-case-id",
  "task_name": "Test Fallback",
  "assigned_user_id": "00000000-0000-0000-0000-000000000000",
  "work_queue_id": "your-queue-id"
}
```

### Step 10.2: Check Backend Logs

Look for fallback behavior:
```
[UserService] Failed to get email for user 00000000-0000-0000-0000-000000000000: User not found
[NotificationService] Using fallback email: user-00000000-0000-0000-0000-000000000000@example.com
[NotificationService] Email sent to fallback address
```

✅ **Success**: Fallback mechanism working (system doesn't crash)

---

## 📊 Verification Checklist

Use this checklist to verify all features:

### Core Notification System
- [ ] User preferences auto-created with defaults
- [ ] User can update preferences via API
- [ ] Validation prevents disabling all channels
- [ ] Test notification sends successfully

### User Email Lookup
- [ ] Real email retrieved from AuthHelperService
- [ ] Email appears in backend logs
- [ ] Email used in SMTP delivery (if configured)
- [ ] Fallback works for unknown users

### Task Assignment Notifications
- [ ] Task assignment triggers notification event
- [ ] Email sent to assigned user
- [ ] Correct email address used (not placeholder)
- [ ] Notification logged in database

### Task Reassignment Notifications
- [ ] Both old and new assignee receive emails
- [ ] Correct email addresses for both users
- [ ] Two separate notification log entries

### Notification History
- [ ] History endpoint returns notifications
- [ ] Pagination works correctly
- [ ] Filtering by status works
- [ ] Filtering by channel works
- [ ] Filtering by type works

### Retry Mechanism
- [ ] Failed notifications marked as FAILED
- [ ] Retry cron job runs every 5 minutes
- [ ] User lookup happens during retry
- [ ] Retry count incremented correctly
- [ ] Status updated to SENT after successful retry

### Suppression
- [ ] Suppression settings saved correctly
- [ ] Suppressed notifications not sent
- [ ] Suppression logged appropriately

### Multi-Channel Delivery
- [ ] Email notifications sent
- [ ] In-app notifications created
- [ ] Dashboard notifications created
- [ ] All channels logged separately

---

## 🐛 Troubleshooting

### Issue: "Unauthorized" Error

**Solution**:
1. Get a fresh token via `/api/v1/auth/login`
2. Click "Authorize" button in Swagger
3. Enter: `Bearer your-token-here`
4. Try request again

### Issue: No Email Sent

**Check**:
1. SMTP configuration in `.env`:
   ```bash
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password
   ```
2. Backend logs for email errors
3. Firewall/network blocking SMTP port 587

### Issue: User Not Found in Logs

**Solution**:
Use one of the known mock user IDs:
```
b29bda5d-f8b4-4a5d-8f12-5b6d6027cf90  (Alice Mwangi)
f8a2c016-2b8d-41da-bbb9-41ad3c26dfc2  (Brian Otieno)
c3c23b1d-ff1c-4922-9f16-89e6d5f334bb  (Felix Mutiso)
```

### Issue: Notification Not in History

**Check**:
1. Correct user ID in token
2. Pagination parameters (page=1, limit=10)
3. Database for notification_logs table
4. Backend logs for errors during logging

### Issue: Retry Not Working

**Check**:
1. Cron job running (check logs every 5 minutes)
2. Notification status is FAILED
3. Retry count < 5
4. Enough time passed since last attempt

---

## 📝 Sample Test Scenarios

### Scenario 1: Happy Path - Full Flow

1. ✅ Login and get token
2. ✅ Check/update notification preferences
3. ✅ Create case → Create queue → Create task
4. ✅ Task assigned to Alice Mwangi
5. ✅ Email sent to alice.mwangi@cms.org
6. ✅ Notification logged with SENT status
7. ✅ History shows the notification

### Scenario 2: Reassignment Flow

1. ✅ Create task assigned to Alice
2. ✅ Alice receives email
3. ✅ Reassign task to Brian
4. ✅ Both Alice and Brian receive emails
5. ✅ Two notification logs created
6. ✅ Both show SENT status

### Scenario 3: Retry Flow

1. ✅ Break SMTP temporarily
2. ✅ Assign task (notification fails)
3. ✅ Fix SMTP
4. ✅ Wait 5 minutes
5. ✅ Retry successful
6. ✅ Status updated to SENT
7. ✅ Retry count = 1

### Scenario 4: Suppression Flow

1. ✅ Enable suppression for task assignments
2. ✅ Assign task
3. ✅ No email sent
4. ✅ Logs show suppression message
5. ✅ Disable suppression
6. ✅ Assign another task
7. ✅ Email sent normally

---

## 📧 Expected Email Content

When you receive a task assignment email, it should look like:

**Subject**: `New Task Assigned: [Task Name]`

**Body** (HTML formatted):
```
New Task Assignment

You have been assigned a new task in the Case Management System.

Task Details:
- Task Name: Test Task Assignment Notification
- Task Type: INVESTIGATION
- Case Number: CASE-12345
- Priority: HIGH
- Deadline: 2025-10-19 10:00:00
- Work Queue: Test Queue
- Assigned By: System

[View Task in Dashboard]

Regards,
CMS Team
```

---

## 🎯 Success Criteria

Your testing is successful when:

✅ All 10 tests pass  
✅ Real email addresses used (from AuthHelperService)  
✅ No hardcoded `user-{id}@example.com` emails in production logs  
✅ Notification history shows all notifications  
✅ Retry mechanism works automatically  
✅ Suppression settings respected  
✅ Multi-channel delivery works  
✅ Fallback mechanism prevents crashes  

---

## 📚 Additional Resources

- **API Documentation**: http://localhost:3000/api
- **Notification System Docs**: `TASK_NOTIFICATION_SYSTEM.md`
- **Module Integration Docs**: `MODULE_INTEGRATION_USER_SERVICE.md`
- **Database Schema**: `prisma/schema.prisma`

---

## 🔍 Database Queries for Verification

### Check Notification Logs
```sql
SELECT 
  notification_log_id,
  user_id,
  notification_type,
  channel,
  delivery_status,
  retry_count,
  sent_at,
  created_at
FROM notification_logs
ORDER BY created_at DESC
LIMIT 10;
```

### Check User Preferences
```sql
SELECT 
  user_id,
  email_enabled,
  in_app_enabled,
  default_channel,
  suppress_task_assigned
FROM user_notification_preferences;
```

### Check Failed Notifications (Pending Retry)
```sql
SELECT 
  notification_log_id,
  user_id,
  channel,
  delivery_status,
  retry_count,
  error_message,
  created_at
FROM notification_logs
WHERE delivery_status = 'FAILED'
  AND retry_count < max_retries
ORDER BY created_at ASC;
```

---

**Happy Testing! 🚀**

---

**Last Updated**: October 18, 2025  
**Version**: 1.0.0  
**Status**: ✅ Ready for Testing
