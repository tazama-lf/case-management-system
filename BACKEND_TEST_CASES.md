# Backend Test Cases - Case Management System

## Document Information
- **System**: Tazama Case Management System - Backend
- **Version**: 0.0.1
- **Last Updated**: 2025-01-XX
- **Test Framework**: Jest, Supertest

---

## Table of Contents
1. [Authentication & Authorization](#1-authentication--authorization)
2. [Case Management](#2-case-management)
3. [Task Management](#3-task-management)
4. [Alert Triage](#4-alert-triage)
5. [Work Queue](#5-work-queue)
6. [Evidence Management](#6-evidence-management)
7. [Reports](#7-reports)
8. [Comments](#8-comments)
9. [Audit Logging](#9-audit-logging)
10. [User Management](#10-user-management)
11. [Profile Management](#11-profile-management)
12. [Integration Tests](#12-integration-tests)

---

## 1. Authentication & Authorization

### 1.1 Login
| TC ID | Test Case | Preconditions | Test Steps | Expected Result | Priority |
|-------|-----------|---------------|------------|------------------|----------|
| AUTH-001 | Successful login with valid credentials | User exists in system | 1. POST /api/v1/auth/login with valid username/password<br>2. Verify response | Returns JWT token, user details, status 200 | High |
| AUTH-002 | Login with invalid credentials | - | 1. POST /api/v1/auth/login with invalid credentials | Returns 401 Unauthorized | High |
| AUTH-003 | Login with missing credentials | - | 1. POST /api/v1/auth/login without body | Returns 400 Bad Request | High |
| AUTH-004 | Token expiry handling | Valid token exists | 1. Make request with expired token | Returns 401, token expiry interceptor triggers | High |
| AUTH-005 | Get current user (me) | User is authenticated | 1. GET /api/v1/auth/me with valid token | Returns user details, status 200 | Medium |

### 1.2 Authorization & Role-Based Access Control
| TC ID | Test Case | Preconditions | Test Steps | Expected Result | Priority |
|-------|-----------|---------------|------------|------------------|----------|
| AUTH-006 | Access with CMS_INVESTIGATOR role | User has INVESTIGATOR role | 1. Access investigator-only endpoint | Returns 200, access granted | High |
| AUTH-007 | Access with CMS_SUPERVISOR role | User has SUPERVISOR role | 1. Access supervisor-only endpoint | Returns 200, access granted | High |
| AUTH-008 | Access with CMS_COMPLIANCE_OFFICER role | User has COMPLIANCE role | 1. Access compliance-only endpoint | Returns 200, access granted | High |
| AUTH-009 | Unauthorized access attempt | User lacks required role | 1. Access endpoint requiring different role | Returns 403 Forbidden | High |
| AUTH-010 | Multi-tenant isolation | User belongs to tenant A | 1. Access data from tenant B | Returns 403 or empty results | High |
| AUTH-011 | Missing authentication token | - | 1. Access protected endpoint without token | Returns 401 Unauthorized | High |

---

## 2. Case Management

### 2.1 Case Creation
| TC ID | Test Case | Preconditions | Test Steps | Expected Result | Priority |
|-------|-----------|---------------|------------|------------------|----------|
| CASE-001 | Create case manually from alert | Alert exists, user has INVESTIGATOR/SUPERVISOR role | 1. POST /api/v1/cases/manual with valid alertId<br>2. Verify case created | Case created in DRAFT status, status 201 | High |
| CASE-002 | Create case via system transmission | User has ALERT_TRIAGE role | 1. POST /api/v1/cases/system-transmission with valid payload | Case created, status 201 | High |
| CASE-003 | Create case with missing required fields | - | 1. POST /api/v1/cases/manual with missing fields | Returns 400 Bad Request | High |
| CASE-004 | Create case from non-existent alert | Alert doesn't exist | 1. POST /api/v1/cases/manual with invalid alertId | Returns 404 Not Found | Medium |
| CASE-005 | Create case from alert that already has a case | Alert already linked to case | 1. POST /api/v1/cases/manual | Returns 400, error message | High |

### 2.2 Case Retrieval
| TC ID | Test Case | Preconditions | Test Steps | Expected Result | Priority |
|-------|-----------|---------------|------------|------------------|----------|
| CASE-006 | Get all cases (Supervisor) | User is SUPERVISOR | 1. GET /api/v1/cases/all | Returns all cases in tenant, status 200 | High |
| CASE-007 | Get all cases (Investigator) | User is INVESTIGATOR | 1. GET /api/v1/cases/all | Returns only unassigned or assigned to user, status 200 | High |
| CASE-008 | Get all cases (Compliance) | User is COMPLIANCE_OFFICER | 1. GET /api/v1/cases/all | Returns only STATUS_82_CLOSED_CONFIRMED cases | High |
| CASE-009 | Get user assigned cases | User is authenticated | 1. GET /api/v1/cases/user/assigned | Returns cases assigned to user, status 200 | High |
| CASE-010 | Get case by ID | Case exists | 1. GET /api/v1/cases/:caseId | Returns case details, status 200 | High |
| CASE-011 | Get non-existent case | - | 1. GET /api/v1/cases/:caseId with invalid ID | Returns 404 Not Found | Medium |
| CASE-012 | Get cases with pagination | Multiple cases exist | 1. GET /api/v1/cases/all?page=1&limit=10 | Returns paginated results, status 200 | Medium |
| CASE-013 | Get cases with filters | Cases exist with different statuses | 1. GET /api/v1/cases/all?status=STATUS_20_IN_PROGRESS | Returns filtered cases, status 200 | Medium |
| CASE-014 | Get user workload statistics | User has assigned cases | 1. GET /api/v1/cases/user/workload | Returns workload stats, status 200 | Medium |

### 2.3 Case State Transitions
| TC ID | Test Case | Preconditions | Test Steps | Expected Result | Priority |
|-------|-----------|---------------|------------|------------------|----------|
| CASE-015 | Complete DRAFT case | Case in DRAFT status, user is INVESTIGATOR/SUPERVISOR | 1. PUT /api/v1/cases/:caseId/complete | Case moves to READY_FOR_ASSIGNMENT, task created, status 200 | High |
| CASE-016 | Abandon DRAFT case | Case in DRAFT status | 1. PUT /api/v1/cases/:caseId/abandon with reason | Case abandoned, task closed, status 200 | High |
| CASE-017 | Suspend IN_PROGRESS case | Case in STATUS_20_IN_PROGRESS | 1. PUT /api/v1/cases/:caseId/suspend with reason | Case suspended, task blocked, status 200 | High |
| CASE-018 | Resume suspended case | Case in SUSPENDED status | 1. PUT /api/v1/cases/:caseId/resume with reason | Case resumed, task unblocked, status 200 | High |
| CASE-019 | Close case (Investigator) | Case in STATUS_20_IN_PROGRESS, task assigned to user | 1. PUT /api/v1/cases/:caseId/close with closure data | Case moves to PENDING_FINAL_APPROVAL, approval task created, status 200 | High |
| CASE-020 | Close case with missing required fields | Case in STATUS_20_IN_PROGRESS | 1. PUT /api/v1/cases/:caseId/close without required fields | Returns 400 with validation errors | High |
| CASE-021 | Close case not assigned to user | Case assigned to different user | 1. PUT /api/v1/cases/:caseId/close | Returns 404 or 403 | High |
| CASE-022 | Reopen closed case | Case in closed status (81/82/83) | 1. PUT /api/v1/cases/:caseId/reopen with reason | Case moves to STATUS_31_REOPENED, approval task created, status 200 | High |

### 2.4 Case Approval Workflows
| TC ID | Test Case | Preconditions | Test Steps | Expected Result | Priority |
|-------|-----------|---------------|------------|------------------|----------|
| CASE-023 | Approve case creation | Case in PENDING_CASE_CREATION_APPROVAL, user is SUPERVISOR | 1. PUT /api/v1/cases/:caseId/approve-creation | Case moves to READY_FOR_ASSIGNMENT, investigation task created, status 200 | High |
| CASE-024 | Reject case creation | Case in PENDING_CASE_CREATION_APPROVAL, user is SUPERVISOR | 1. PUT /api/v1/cases/:caseId/reject-creation with reason | Case returns to DRAFT, task created for creator, status 200 | High |
| CASE-025 | Approve case closure (Confirmed) | Case in PENDING_FINAL_APPROVAL, user is SUPERVISOR | 1. PUT /api/v1/cases/:caseId/approve with STATUS_82_CLOSED_CONFIRMED | Case closed as confirmed, status 200 | High |
| CASE-026 | Approve case closure (Refuted) | Case in PENDING_FINAL_APPROVAL, user is SUPERVISOR | 1. PUT /api/v1/cases/:caseId/approve with STATUS_81_CLOSED_REFUTED | Case closed as refuted, status 200 | High |
| CASE-027 | Approve case closure (Inconclusive) | Case in PENDING_FINAL_APPROVAL, user is SUPERVISOR | 1. PUT /api/v1/cases/:caseId/approve with STATUS_83_CLOSED_INCONCLUSIVE | Case closed as inconclusive, status 200 | High |
| CASE-028 | Reject case closure | Case in PENDING_FINAL_APPROVAL, user is SUPERVISOR | 1. PUT /api/v1/cases/:caseId/reject with rejection reason | Case returns to IN_PROGRESS, new investigation task created, status 200 | High |
| CASE-029 | Approve case reopening | Case in STATUS_31_REOPENED, user is SUPERVISOR | 1. PUT /api/v1/cases/:caseId/approve-reopening | Case assigned based on requester role, investigation task created, status 200 | High |
| CASE-030 | Reject case reopening | Case in STATUS_31_REOPENED, user is SUPERVISOR | 1. PUT /api/v1/cases/:caseId/reject-reopening with reason | Case returns to original closed status, status 200 | High |
| CASE-031 | Return case for review | Case in PENDING_FINAL_APPROVAL, user is SUPERVISOR | 1. PUT /api/v1/cases/:caseId/return-for-review with comments | Case returns to IN_PROGRESS, status 200 | High |

### 2.5 Case Updates
| TC ID | Test Case | Preconditions | Test Steps | Expected Result | Priority |
|-------|-----------|---------------|------------|------------------|----------|
| CASE-032 | Update case details | Case exists, user has permission | 1. POST /api/v1/cases/:caseId with update data | Case updated, status 200 | Medium |
| CASE-033 | Update case with invalid data | Case exists | 1. POST /api/v1/cases/:caseId with invalid fields | Returns 400 Bad Request | Medium |
| CASE-034 | Update non-existent case | - | 1. POST /api/v1/cases/:caseId | Returns 404 Not Found | Low |

---

## 3. Task Management

### 3.1 Task Creation
| TC ID | Test Case | Preconditions | Test Steps | Expected Result | Priority |
|-------|-----------|---------------|------------|------------------|----------|
| TASK-001 | Create unassigned task | Case exists, user has ALERT_TRIAGE role | 1. POST /api/v1/task with valid data | Task created in UNASSIGNED status, status 201 | High |
| TASK-002 | Create and assign task | Case exists, user has ALERT_TRIAGE role | 1. POST /api/v1/task with assignedUserId | Task created in ASSIGNED status, status 201 | High |
| TASK-003 | Create task with invalid case ID | - | 1. POST /api/v1/task with invalid caseId | Returns 400 Bad Request | High |
| TASK-004 | Create task without required fields | - | 1. POST /api/v1/task with missing fields | Returns 400 Bad Request | High |

### 3.2 Task Assignment
| TC ID | Test Case | Preconditions | Test Steps | Expected Result | Priority |
|-------|-----------|---------------|------------|------------------|----------|
| TASK-005 | Assign task to investigator | Task is UNASSIGNED, user is SUPERVISOR/INVESTIGATOR | 1. PATCH /api/v1/task/:taskId/assign with assignedUserId | Task assigned, status changed to ASSIGNED, status 200 | High |
| TASK-006 | Self-assign task (Investigator) | Task is UNASSIGNED, user is INVESTIGATOR | 1. PATCH /api/v1/task/:taskId/self-assign | Task assigned to current user, status 200 | High |
| TASK-007 | Reassign task | Task is ASSIGNED, user is SUPERVISOR/INVESTIGATOR | 1. PATCH /api/v1/task/:taskId/reassign with new assignedUserId | Task reassigned, status 200 | High |
| TASK-008 | Unassign task | Task is ASSIGNED | 1. PATCH /api/v1/task/:taskId/unassign with reason | Task unassigned, returns to UNASSIGNED, status 200 | High |
| TASK-009 | Assign task to user without required role | Task requires specific role | 1. PATCH /api/v1/task/:taskId/assign to user without role | Returns 400 or 403 | High |
| TASK-010 | Assign already assigned task | Task is ASSIGNED | 1. PATCH /api/v1/task/:taskId/assign | Returns 400, task already assigned | Medium |
| TASK-011 | Reassign task to different work queue | Task exists, user is SUPERVISOR | 1. POST /api/v1/task/:taskId/reassign-queue with targetWorkQueueId | Task moved to new queue, status 200 | High |

### 3.3 Task Updates
| TC ID | Test Case | Preconditions | Test Steps | Expected Result | Priority |
|-------|-----------|---------------|------------|------------------|----------|
| TASK-012 | Update task status | Task exists, user is INVESTIGATOR | 1. PATCH /api/v1/task/:taskId with status update | Task status updated, status 200 | High |
| TASK-013 | Complete task | Task is IN_PROGRESS, user is INVESTIGATOR | 1. PATCH /api/v1/task/:taskId with STATUS_30_COMPLETED | Task completed, status 200 | High |
| TASK-014 | Update task description | Task exists, user is INVESTIGATOR | 1. PATCH /api/v1/task/:taskId with description | Task description updated, status 200 | Medium |
| TASK-015 | Update task with invalid status | Task exists | 1. PATCH /api/v1/task/:taskId with invalid status | Returns 400 Bad Request | Medium |

### 3.4 Task Retrieval
| TC ID | Test Case | Preconditions | Test Steps | Expected Result | Priority |
|-------|-----------|---------------|------------|------------------|----------|
| TASK-016 | Get all tasks | User is authenticated | 1. GET /api/v1/task | Returns list of tasks, status 200 | High |
| TASK-017 | Get tasks by status | Tasks exist | 1. GET /api/v1/task?status=STATUS_01_UNASSIGNED | Returns filtered tasks, status 200 | Medium |
| TASK-018 | Get tasks for case | Case exists | 1. GET /api/v1/task/case/:caseId | Returns tasks for case, status 200 | High |
| TASK-019 | Get task by ID | Task exists | 1. GET /api/v1/task/:taskId | Returns task details, status 200 | High |
| TASK-020 | Get work queue tasks | User has access to queue | 1. GET /api/v1/task/work-queues/:candidateGroup | Returns tasks from Flowable/domain, status 200 | High |
| TASK-021 | Get work queue with pagination | Multiple tasks exist | 1. GET /api/v1/task/work-queues/:candidateGroup?page=1&limit=20 | Returns paginated tasks, status 200 | Medium |
| TASK-022 | Get work queue unassigned only | Tasks exist | 1. GET /api/v1/task/work-queues/:candidateGroup?unassignedOnly=true | Returns only unassigned tasks, status 200 | Medium |
| TASK-023 | Get work queue statistics | User is authenticated | 1. GET /api/v1/task/statistics | Returns task statistics, status 200 | Medium |
| TASK-024 | Investigator access to restricted queue | User is INVESTIGATOR | 1. GET /api/v1/task/work-queues/supervisors | Returns 403 Forbidden | High |

---

## 4. Alert Triage

### 4.1 Alert Ingestion
| TC ID | Test Case | Preconditions | Test Steps | Expected Result | Priority |
|-------|-----------|---------------|------------|------------------|----------|
| TRIAGE-001 | Ingest new alert | User has INVESTIGATOR/SUPERVISOR role | 1. POST /api/v1/triage/alerts with valid alert data | Alert created, status 201 | High |
| TRIAGE-002 | Ingest alert with missing required fields | - | 1. POST /api/v1/triage/alerts with incomplete data | Returns 400 Bad Request | High |
| TRIAGE-003 | Process incoming alert event | User has INVESTIGATOR/SUPERVISOR role | 1. POST /api/v1/triage/alerts/ingest with AlertMessageDto | Alert processed, status 201 | High |

### 4.2 Alert Retrieval
| TC ID | Test Case | Preconditions | Test Steps | Expected Result | Priority |
|-------|-----------|---------------|------------|------------------|----------|
| TRIAGE-004 | Get all alerts | User has INVESTIGATOR/SUPERVISOR role | 1. GET /api/v1/triage/alerts | Returns paginated alerts, status 200 | High |
| TRIAGE-005 | Get alerts with priority filter | Alerts exist | 1. GET /api/v1/triage/alerts?priority=URGENT | Returns filtered alerts, status 200 | Medium |
| TRIAGE-006 | Get alerts with search | Alerts exist | 1. GET /api/v1/triage/alerts?search=term | Returns matching alerts, status 200 | Medium |
| TRIAGE-007 | Get alerts with pagination | Multiple alerts exist | 1. GET /api/v1/triage/alerts?page=1&limit=10 | Returns paginated results, status 200 | Medium |
| TRIAGE-008 | Get alert details | Alert exists | 1. GET /api/v1/triage/alerts/:alertId | Returns alert details, status 200 | High |
| TRIAGE-009 | Get alert action history | Alert exists | 1. GET /api/v1/triage/alerts/:alertId/action-history | Returns action history, status 200 | Medium |
| TRIAGE-010 | Get non-existent alert | - | 1. GET /api/v1/triage/alerts/:alertId | Returns 404 Not Found | Low |

### 4.3 Manual Triage
| TC ID | Test Case | Preconditions | Test Steps | Expected Result | Priority |
|-------|-----------|---------------|------------|------------------|----------|
| TRIAGE-011 | Perform manual triage | Alert exists, user has INVESTIGATOR/SUPERVISOR role | 1. PATCH /api/v1/triage/alerts/:alertId with triage data | Alert updated, status 200 | High |
| TRIAGE-012 | Manual triage with invalid data | Alert exists | 1. PATCH /api/v1/triage/alerts/:alertId with invalid data | Returns 400 Bad Request | High |
| TRIAGE-013 | Triage non-existent alert | - | 1. PATCH /api/v1/triage/alerts/:alertId | Returns 404 Not Found | Medium |

---

## 5. Work Queue

### 5.1 Work Queue Operations
| TC ID | Test Case | Preconditions | Test Steps | Expected Result | Priority |
|-------|-----------|---------------|------------|------------------|----------|
| WQ-001 | Get investigations queue | User has INVESTIGATOR/SUPERVISOR role | 1. GET /api/v1/task/work-queues/investigations | Returns tasks from investigations queue, status 200 | High |
| WQ-002 | Get supervisors queue | User has SUPERVISOR role | 1. GET /api/v1/task/work-queues/supervisors | Returns tasks from supervisors queue, status 200 | High |
| WQ-003 | Get analysts queue | User has appropriate role | 1. GET /api/v1/task/work-queues/analysts | Returns tasks from analysts queue, status 200 | Medium |
| WQ-004 | Flowable service fallback | Flowable unavailable | 1. GET /api/v1/task/work-queues/:candidateGroup | Falls back to domain tables, returns 503 with warning | High |
| WQ-005 | Get invalid queue | - | 1. GET /api/v1/task/work-queues/invalid | Returns 404 Not Found | Low |

---

## 6. Evidence Management

### 6.1 Evidence Upload
| TC ID | Test Case | Preconditions | Test Steps | Expected Result | Priority |
|-------|-----------|---------------|------------|------------------|----------|
| EVID-001 | Upload evidence file | Task exists, user has INVESTIGATOR/SUPERVISOR/COMPLIANCE role | 1. POST /api/v1/evidence/upload with file and taskId | Evidence uploaded, status 201 | High |
| EVID-002 | Upload multiple evidence files | Task exists | 1. POST /api/v1/evidence/upload with multiple files | All files uploaded, status 201 | High |
| EVID-003 | Upload evidence exceeding size limit | Task exists | 1. POST /api/v1/evidence/upload with file > 100MB | Returns 400 Bad Request | High |
| EVID-004 | Upload evidence without file | Task exists | 1. POST /api/v1/evidence/upload without file | Returns 400 Bad Request | High |
| EVID-005 | Upload evidence with invalid task ID | - | 1. POST /api/v1/evidence/upload with invalid taskId | Returns 400 or 404 | High |
| EVID-006 | Upload evidence with different types | Task exists | 1. POST /api/v1/evidence/upload with SAR_STR_FILING type | Evidence uploaded with correct type, status 201 | Medium |

### 6.2 Evidence Retrieval
| TC ID | Test Case | Preconditions | Test Steps | Expected Result | Priority |
|-------|-----------|---------------|------------|------------------|----------|
| EVID-007 | Get evidence by task ID | Task exists with evidence | 1. GET /api/v1/evidence/task/:taskId | Returns evidence list, status 200 | High |
| EVID-008 | Get evidence by case ID | Case exists with evidence | 1. GET /api/v1/evidence/case/:caseId | Returns evidence list, status 200 | High |
| EVID-009 | Get evidence by type | Evidence exists | 1. GET /api/v1/evidence/evidenceType/:evidenceType | Returns filtered evidence, status 200 | Medium |
| EVID-010 | Get evidence by ID | Evidence exists | 1. GET /api/v1/evidence/:id | Returns evidence metadata, status 200 | High |
| EVID-011 | Download evidence file | Evidence exists | 1. GET /api/v1/evidence/:id/download | Returns file download, status 200 | High |
| EVID-012 | Verify evidence integrity | Evidence exists | 1. GET /api/v1/evidence/:id/verify | Returns verification result, status 200 | Medium |
| EVID-013 | Get evidence for non-existent task | - | 1. GET /api/v1/evidence/task/:taskId | Returns empty array or 404 | Low |

---

## 7. Reports

### 7.1 Fraud Report Generation
| TC ID | Test Case | Preconditions | Test Steps | Expected Result | Priority |
|-------|-----------|---------------|------------|------------------|----------|
| RPT-001 | Generate fraud report | Case exists, user has INVESTIGATOR/SUPERVISOR role | 1. POST /api/v1/reports/fraud/generate with caseId and inputs | Report generated, status 201 | High |
| RPT-002 | Generate report with missing fields | Case exists | 1. POST /api/v1/reports/fraud/generate without required fields | Returns 400 Bad Request | High |
| RPT-003 | Edit fraud report | Report exists, user has permission | 1. PUT /api/v1/reports/fraud/edit/:reportId with updates | Report updated, status 200 | High |
| RPT-004 | Approve fraud report | Report exists, user has SUPERVISOR role | 1. POST /api/v1/reports/fraud/approve with outcome | Report approved and archived, status 200 | High |
| RPT-005 | Get fraud reports for case | Case exists | 1. GET /api/v1/reports/fraud/:caseId | Returns report list, status 200 | High |

### 7.2 Analytics Reports
| TC ID | Test Case | Preconditions | Test Steps | Expected Result | Priority |
|-------|-----------|---------------|------------|------------------|----------|
| RPT-006 | Get case status report | User has INVESTIGATOR/SUPERVISOR role | 1. GET /api/v1/reports/case-status | Returns case status analytics, status 200 | Medium |
| RPT-007 | Get case status with filters | Cases exist | 1. GET /api/v1/reports/case-status?dateRange=last30&caseType=FRAUD | Returns filtered analytics, status 200 | Medium |
| RPT-008 | Get investigator workload report | User has INVESTIGATOR/SUPERVISOR role | 1. GET /api/v1/reports/investigator-workload | Returns workload metrics, status 200 | Medium |
| RPT-009 | Get audit logs report | User has INVESTIGATOR/SUPERVISOR role | 1. GET /api/v1/reports/audit-logs | Returns audit log data, status 200 | Medium |
| RPT-010 | Get case ageing report | User has INVESTIGATOR/SUPERVISOR role | 1. GET /api/v1/reports/case-ageing | Returns ageing analytics, status 200 | Medium |
| RPT-011 | Get report filters | User is authenticated | 1. GET /api/v1/reports/filters | Returns available filter options, status 200 | Low |

---

## 8. Comments

### 8.1 Comment Operations
| TC ID | Test Case | Preconditions | Test Steps | Expected Result | Priority |
|-------|-----------|---------------|------------|------------------|----------|
| COMM-001 | Add comment to case | Case exists, user is authenticated | 1. POST /api/v1/comment with caseId and comment text | Comment created, status 201 | High |
| COMM-002 | Add comment to task | Task exists, user is authenticated | 1. POST /api/v1/comment with taskId and comment text | Comment created, status 201 | High |
| COMM-003 | Add comment with missing fields | - | 1. POST /api/v1/comment without required fields | Returns 400 Bad Request | High |
| COMM-004 | Get comments for case | Case exists with comments | 1. GET /api/v1/comment/case/:caseId | Returns comment list, status 200 | Medium |
| COMM-005 | Get comments for task | Task exists with comments | 1. GET /api/v1/comment/task/:taskId | Returns comment list, status 200 | Medium |

---

## 9. Audit Logging

### 9.1 Audit Operations
| TC ID | Test Case | Preconditions | Test Steps | Expected Result | Priority |
|-------|-----------|---------------|------------|------------------|----------|
| AUDIT-001 | Audit log created on case update | Case updated | 1. Verify audit log service called | Audit log entry created | High |
| AUDIT-002 | Audit log created on task assignment | Task assigned | 1. Verify audit log service called | Audit log entry created | High |
| AUDIT-003 | Audit log includes user information | Action performed | 1. Check audit log entry | Contains userId, timestamp, action | High |
| AUDIT-004 | Audit log includes outcome | Action performed | 1. Check audit log entry | Contains SUCCESS/FAILURE outcome | High |
| AUDIT-005 | Get audit logs | User has permission | 1. GET /api/v1/audit-logs (if endpoint exists) | Returns audit log entries, status 200 | Medium |

---

## 10. User Management

### 10.1 User Operations
| TC ID | Test Case | Preconditions | Test Steps | Expected Result | Priority |
|-------|-----------|---------------|------------|------------------|----------|
| USER-001 | Get user list | User has SUPERVISOR role | 1. GET /api/v1/user (if endpoint exists) | Returns user list, status 200 | Medium |
| USER-002 | Get user by ID | User exists | 1. GET /api/v1/user/:userId | Returns user details, status 200 | Medium |
| USER-003 | User tenant isolation | User from tenant A | 1. Access user from tenant B | Returns 403 or empty results | High |

---

## 11. Profile Management

### 11.1 Profile Operations
| TC ID | Test Case | Preconditions | Test Steps | Expected Result | Priority |
|-------|-----------|---------------|------------|------------------|----------|
| PROF-001 | Generate profile for case | Case exists | 1. POST /api/v1/profile/generate with caseId | Profile generated, status 200 | Medium |
| PROF-002 | Get profile for case | Profile exists | 1. GET /api/v1/profile/case/:caseId | Returns profile data, status 200 | Medium |

---

## 12. Integration Tests

### 12.1 End-to-End Workflows
| TC ID | Test Case | Preconditions | Test Steps | Expected Result | Priority |
|-------|-----------|---------------|------------|------------------|----------|
| E2E-001 | Complete case lifecycle | Alert exists | 1. Create case from alert<br>2. Approve case creation<br>3. Assign task<br>4. Complete task<br>5. Close case<br>6. Approve closure | All steps complete successfully | High |
| E2E-002 | Case reopening workflow | Closed case exists | 1. Request case reopening<br>2. Approve reopening<br>3. Assign investigation task<br>4. Complete investigation | Case successfully reopened and investigated | High |
| E2E-003 | Evidence upload and retrieval | Case and task exist | 1. Upload evidence<br>2. Get evidence by task<br>3. Download evidence<br>4. Verify evidence | Evidence workflow complete | Medium |
| E2E-004 | Report generation workflow | Case exists | 1. Generate fraud report<br>2. Edit report<br>3. Approve report | Report workflow complete | Medium |
| E2E-005 | Multi-tenant isolation | Users from different tenants | 1. User A creates case<br>2. User B (different tenant) tries to access | User B cannot access User A's case | High |

---
