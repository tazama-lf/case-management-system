# Frontend Test Cases - Case Management System

## Document Information
- **System**: Tazama Case Management System - Frontend
- **Version**: 0.0.1
- **Last Updated**: 2025-01-XX
- **Test Framework**: Vitest, React Testing Library

---

## Table of Contents
1. [Authentication](#1-authentication)
2. [Navigation & Routing](#2-navigation--routing)
3. [Dashboard](#3-dashboard)
4. [Case Management](#4-case-management)
5. [Alert Management](#5-alert-management)
6. [Work Queue](#6-work-queue)
7. [Reports](#7-reports)
8. [Admin Dashboard](#8-admin-dashboard)
9. [Evidence Management](#9-evidence-management)
10. [UI/UX Components](#10-uiux-components)

---

## 1. Authentication

### 1.1 Login Flow
| TC ID | Test Case | Preconditions | Test Steps | Expected Result | Priority |
|-------|-----------|---------------|------------|------------------|----------|
| FE-AUTH-001 | Successful login | Valid credentials exist | 1. Navigate to login page<br>2. Enter valid username/password<br>3. Click login | User redirected to dashboard, token stored, status 200 | High |
| FE-AUTH-002 | Login with invalid credentials | - | 1. Enter invalid credentials<br>2. Click login | Error message displayed, user stays on login page | High |
| FE-AUTH-003 | Login with empty fields | - | 1. Leave fields empty<br>2. Click login | Validation errors shown, form not submitted | High |
| FE-AUTH-004 | Login form validation | - | 1. Enter invalid email format<br>2. Click login | Email validation error displayed | Medium |
| FE-AUTH-005 | Remember me functionality | - | 1. Check "Remember me"<br>2. Login successfully<br>3. Close browser<br>4. Reopen | User remains logged in | Low |
| FE-AUTH-006 | Token expiry handling | User logged in, token expires | 1. Wait for token expiry<br>2. Make API request | User redirected to login, error message shown | High |
| FE-AUTH-007 | Logout functionality | User is logged in | 1. Click logout button<br>2. Confirm logout | User logged out, redirected to login, token cleared | High |

### 1.2 Protected Routes
| TC ID | Test Case | Preconditions | Test Steps | Expected Result | Priority |
|-------|-----------|---------------|------------|------------------|----------|
| FE-AUTH-008 | Access protected route without auth | User not logged in | 1. Navigate to /cases directly | Redirected to login page | High |
| FE-AUTH-009 | Access protected route with valid auth | User is logged in | 1. Navigate to /cases | Page loads successfully | High |
| FE-AUTH-010 | Role-based route access | User with INVESTIGATOR role | 1. Navigate to /admin | Redirected or access denied message | High |
| FE-AUTH-011 | Session persistence | User logged in | 1. Refresh page | User remains logged in | Medium |

---

## 2. Navigation & Routing

### 2.1 Navigation Components
| TC ID | Test Case | Preconditions | Test Steps | Expected Result | Priority |
|-------|-----------|---------------|------------|------------------|----------|
| FE-NAV-001 | Main navigation menu display | User is logged in | 1. View navigation bar | All menu items visible based on role | High |
| FE-NAV-002 | Navigate to Dashboard | User is logged in | 1. Click Dashboard link | Navigate to /dashboard, page loads | High |
| FE-NAV-003 | Navigate to Cases | User is logged in | 1. Click Cases link | Navigate to /cases, page loads | High |
| FE-NAV-004 | Navigate to Alerts | User is logged in | 1. Click Alerts link | Navigate to /alerts, page loads | High |
| FE-NAV-005 | Navigate to Work Queue | User is logged in | 1. Click Work Queue link | Navigate to /workqueue, page loads | High |
| FE-NAV-006 | Navigate to Reports | User is logged in | 1. Click Reports link | Navigate to /reports, page loads | High |
| FE-NAV-007 | Navigate to Admin | User is logged in with ADMIN role | 1. Click Admin link | Navigate to /admin, page loads | High |
| FE-NAV-008 | Active route highlighting | User is on Cases page | 1. View navigation | Cases link highlighted/active | Medium |
| FE-NAV-009 | Breadcrumb navigation | User navigates deep | 1. Navigate to case details | Breadcrumbs show path | Medium |
| FE-NAV-010 | Back button functionality | User on detail page | 1. Click back button | Returns to previous page | Medium |
| FE-NAV-011 | Mobile navigation menu | User on mobile device | 1. Click hamburger menu | Mobile menu opens/closes | Medium |

---

## 3. Dashboard

### 3.1 Dashboard Display
| TC ID | Test Case | Preconditions | Test Steps | Expected Result | Priority |
|-------|-----------|---------------|------------|------------------|----------|
| FE-DASH-001 | Dashboard loads with statistics | User is logged in | 1. Navigate to /dashboard | Statistics cards displayed, data loaded | High |
| FE-DASH-002 | Dashboard statistics accuracy | Data exists | 1. View dashboard stats | Numbers match actual data | High |
| FE-DASH-003 | Dashboard loading state | - | 1. Navigate to /dashboard | Loading skeleton/spinner shown | Medium |
| FE-DASH-004 | Dashboard error state | API error occurs | 1. Navigate to /dashboard | Error message displayed | Medium |
| FE-DASH-005 | Alert summary section | Alerts exist | 1. View dashboard | Alert summary displayed with counts | High |
| FE-DASH-006 | Case summary section | Cases exist | 1. View dashboard | Case summary displayed with counts | High |
| FE-DASH-007 | Recent activity section | Activity exists | 1. View dashboard | Recent activity list displayed | Medium |
| FE-DASH-008 | Dashboard refresh | Data on dashboard | 1. Click refresh button | Data reloaded, updated | Low |
| FE-DASH-009 | Dashboard responsive design | - | 1. Resize browser window | Layout adapts to screen size | Medium |
| FE-DASH-010 | Dashboard empty state | No data exists | 1. View dashboard | Empty state message displayed | Low |

---

## 4. Case Management

### 4.1 Case List View
| TC ID | Test Case | Preconditions | Test Steps | Expected Result | Priority |
|-------|-----------|---------------|------------|------------------|----------|
| FE-CASE-001 | Cases table displays | Cases exist | 1. Navigate to /cases | Cases table rendered with data | High |
| FE-CASE-002 | Cases table columns | Cases exist | 1. View cases table | All required columns visible | High |
| FE-CASE-003 | Cases table pagination | Multiple cases exist | 1. View cases table<br>2. Click next page | Next page of cases loaded | High |
| FE-CASE-004 | Cases table sorting | Cases exist | 1. Click column header | Table sorted by column | Medium |
| FE-CASE-005 | Cases table filtering | Cases exist | 1. Apply status filter | Only filtered cases shown | High |
| FE-CASE-006 | Cases table search | Cases exist | 1. Enter search term | Matching cases displayed | High |
| FE-CASE-007 | Cases loading state | - | 1. Navigate to /cases | Loading skeleton shown | Medium |
| FE-CASE-008 | Cases empty state | No cases exist | 1. Navigate to /cases | Empty state message shown | Low |
| FE-CASE-009 | Cases error state | API error | 1. Navigate to /cases | Error message displayed | Medium |
| FE-CASE-010 | Case priority badges | Cases with priorities | 1. View cases table | Priority badges displayed with colors | Medium |
| FE-CASE-011 | Case status badges | Cases with statuses | 1. View cases table | Status badges displayed | Medium |

### 4.2 Case Creation
| TC ID | Test Case | Preconditions | Test Steps | Expected Result | Priority |
|-------|-----------|---------------|------------|------------------|----------|
| FE-CASE-012 | Open create case modal | User has permission | 1. Click "Create Case" button | Modal opens with form | High |
| FE-CASE-013 | Create case from alert | Alert exists | 1. Select alert<br>2. Click "Create Case"<br>3. Fill form<br>4. Submit | Case created, modal closes, success message | High |
| FE-CASE-014 | Create case form validation | - | 1. Open create modal<br>2. Submit empty form | Validation errors displayed | High |
| FE-CASE-015 | Create case with required fields | Alert exists | 1. Fill required fields<br>2. Submit | Case created successfully | High |
| FE-CASE-016 | Cancel case creation | - | 1. Open create modal<br>2. Click cancel | Modal closes, no case created | Medium |
| FE-CASE-017 | Create case error handling | API error | 1. Submit create case form | Error message displayed | Medium |

### 4.3 Case Details View
| TC ID | Test Case | Preconditions | Test Steps | Expected Result | Priority |
|-------|-----------|---------------|------------|------------------|----------|
| FE-CASE-018 | View case details | Case exists | 1. Click case in table | Case details modal/page opens | High |
| FE-CASE-019 | Case details information | Case exists | 1. Open case details | All case information displayed | High |
| FE-CASE-020 | Case details tabs | Case exists | 1. Open case details<br>2. Click different tabs | Tab content switches correctly | Medium |
| FE-CASE-021 | Case tasks section | Case has tasks | 1. View case details<br>2. Open tasks tab | Tasks list displayed | High |
| FE-CASE-022 | Case comments section | Case has comments | 1. View case details<br>2. Open comments tab | Comments displayed | Medium |
| FE-CASE-023 | Case evidence section | Case has evidence | 1. View case details<br>2. Open evidence tab | Evidence list displayed | High |
| FE-CASE-024 | Case history/audit log | Case exists | 1. View case details<br>2. Open history tab | History/audit log displayed | Medium |

### 4.4 Case Actions
| TC ID | Test Case | Preconditions | Test Steps | Expected Result | Priority |
|-------|-----------|---------------|------------|------------------|----------|
| FE-CASE-025 | Complete case | Case in DRAFT status | 1. Open case<br>2. Click "Complete"<br>3. Confirm | Case completed, status updated | High |
| FE-CASE-026 | Abandon case | Case in DRAFT status | 1. Open case<br>2. Click "Abandon"<br>3. Enter reason<br>4. Confirm | Case abandoned, status updated | High |
| FE-CASE-027 | Suspend case | Case in IN_PROGRESS | 1. Open case<br>2. Click "Suspend"<br>3. Enter reason<br>4. Confirm | Case suspended, status updated | High |
| FE-CASE-028 | Resume case | Case in SUSPENDED | 1. Open case<br>2. Click "Resume"<br>3. Enter reason<br>4. Confirm | Case resumed, status updated | High |
| FE-CASE-029 | Close case | Case in IN_PROGRESS | 1. Open case<br>2. Click "Close Case"<br>3. Fill closure form<br>4. Submit | Case closed, approval task created | High |
| FE-CASE-030 | Reopen case | Case in closed status | 1. Open case<br>2. Click "Reopen"<br>3. Enter reason<br>4. Confirm | Reopening request submitted | High |
| FE-CASE-031 | Approve case creation | Case in PENDING_CREATION_APPROVAL, user is SUPERVISOR | 1. View case<br>2. Click "Approve" | Case approved, status updated | High |
| FE-CASE-032 | Reject case creation | Case in PENDING_CREATION_APPROVAL, user is SUPERVISOR | 1. View case<br>2. Click "Reject"<br>3. Enter reason<br>4. Confirm | Case rejected, returned to DRAFT | High |
| FE-CASE-033 | Approve case closure | Case in PENDING_FINAL_APPROVAL, user is SUPERVISOR | 1. View case<br>2. Click "Approve Closure"<br>3. Select outcome<br>4. Submit | Case closure approved | High |
| FE-CASE-034 | Reject case closure | Case in PENDING_FINAL_APPROVAL, user is SUPERVISOR | 1. View case<br>2. Click "Reject Closure"<br>3. Enter reason<br>4. Submit | Case returned for investigation | High |
| FE-CASE-035 | Update case details | Case exists, user has permission | 1. Open case<br>2. Click "Edit"<br>3. Update fields<br>4. Save | Case updated, success message | Medium |
| FE-CASE-036 | Action button visibility by role | User with INVESTIGATOR role | 1. View case | Only appropriate action buttons visible | High |
| FE-CASE-037 | Action button visibility by status | Case in DRAFT | 1. View case | Only valid actions for status visible | High |

### 4.5 Case Filters
| TC ID | Test Case | Preconditions | Test Steps | Expected Result | Priority |
|-------|-----------|---------------|------------|------------------|----------|
| FE-CASE-038 | Filter by status | Cases with different statuses | 1. Select status filter | Only matching cases shown | High |
| FE-CASE-039 | Filter by priority | Cases with different priorities | 1. Select priority filter | Only matching cases shown | High |
| FE-CASE-040 | Filter by case type | Cases with different types | 1. Select type filter | Only matching cases shown | Medium |
| FE-CASE-041 | Filter by date range | Cases with different dates | 1. Select date range | Only matching cases shown | Medium |
| FE-CASE-042 | Multiple filters combined | Cases exist | 1. Apply multiple filters | Cases matching all filters shown | High |
| FE-CASE-043 | Clear filters | Filters applied | 1. Click "Clear Filters" | All filters cleared, all cases shown | Medium |
| FE-CASE-044 | Filter persistence | Filters applied | 1. Apply filters<br>2. Navigate away<br>3. Return | Filters maintained | Low |

---

## 5. Alert Management

### 5.1 Alert List View
| TC ID | Test Case | Preconditions | Test Steps | Expected Result | Priority |
|-------|-----------|---------------|------------|------------------|----------|
| FE-ALERT-001 | Alerts table displays | Alerts exist | 1. Navigate to /alerts | Alerts table rendered | High |
| FE-ALERT-002 | Alerts table pagination | Multiple alerts exist | 1. View alerts<br>2. Click next page | Next page loaded | High |
| FE-ALERT-003 | Alerts table sorting | Alerts exist | 1. Click column header | Table sorted | Medium |
| FE-ALERT-004 | Alerts table search | Alerts exist | 1. Enter search term | Matching alerts shown | High |
| FE-ALERT-005 | Alert priority display | Alerts with priorities | 1. View alerts table | Priority badges displayed | Medium |
| FE-ALERT-006 | Alert loading state | - | 1. Navigate to /alerts | Loading skeleton shown | Medium |
| FE-ALERT-007 | Alert empty state | No alerts exist | 1. Navigate to /alerts | Empty state message | Low |
| FE-ALERT-008 | Alert error state | API error | 1. Navigate to /alerts | Error message displayed | Medium |

### 5.2 Alert Details
| TC ID | Test Case | Preconditions | Test Steps | Expected Result | Priority |
|-------|-----------|---------------|------------|------------------|----------|
| FE-ALERT-009 | View alert details | Alert exists | 1. Click alert in table | Alert details modal opens | High |
| FE-ALERT-010 | Alert details information | Alert exists | 1. Open alert details | All alert information displayed | High |
| FE-ALERT-011 | Alert transaction data | Alert has transactions | 1. View alert details<br>2. Open transactions tab | Transaction data displayed | High |
| FE-ALERT-012 | Alert message payload | Alert exists | 1. View alert details<br>2. Open payload tab | Message payload displayed | Medium |
| FE-ALERT-013 | Alert action history | Alert has history | 1. View alert details<br>2. Open history tab | Action history displayed | Medium |

### 5.3 Alert Actions
| TC ID | Test Case | Preconditions | Test Steps | Expected Result | Priority |
|-------|-----------|---------------|------------|------------------|----------|
| FE-ALERT-014 | Manual triage | Alert exists, user has permission | 1. Open alert<br>2. Click "Manual Triage"<br>3. Update status/priority<br>4. Submit | Alert triaged, status updated | High |
| FE-ALERT-015 | Create case from alert | Alert exists | 1. Open alert<br>2. Click "Create Case" | Create case modal opens | High |
| FE-ALERT-016 | Update alert | Alert exists | 1. Open alert<br>2. Click "Update"<br>3. Modify fields<br>4. Save | Alert updated, success message | Medium |
| FE-ALERT-017 | Alert filters | Alerts exist | 1. Apply filters (priority, type, source) | Filtered alerts shown | High |
| FE-ALERT-018 | Triage mode indicator | Triage mode active | 1. View alerts page | Triage mode indicator visible | Medium |

---

## 6. Work Queue

### 6.1 Work Queue Display
| TC ID | Test Case | Preconditions | Test Steps | Expected Result | Priority |
|-------|-----------|---------------|------------|------------------|----------|
| FE-WQ-001 | Work queue page loads | User is logged in | 1. Navigate to /workqueue | Work queue page displayed | High |
| FE-WQ-002 | Queue selection dropdown | User has access to queues | 1. View work queue page | Queue dropdown with available queues | High |
| FE-WQ-003 | Tasks table displays | Tasks exist in queue | 1. Select queue | Tasks table rendered | High |
| FE-WQ-004 | Task information columns | Tasks exist | 1. View tasks table | All required columns visible | High |
| FE-WQ-005 | Task status badges | Tasks with statuses | 1. View tasks table | Status badges displayed | Medium |
| FE-WQ-006 | Unassigned tasks filter | Tasks exist | 1. Toggle "Unassigned Only" | Only unassigned tasks shown | High |
| FE-WQ-007 | Work queue pagination | Multiple tasks exist | 1. View tasks<br>2. Click next page | Next page loaded | High |
| FE-WQ-008 | Work queue loading state | - | 1. Navigate to /workqueue | Loading skeleton shown | Medium |
| FE-WQ-009 | Work queue error state | API error | 1. Navigate to /workqueue | Error message displayed | Medium |
| FE-WQ-010 | Work queue statistics | Tasks exist | 1. View work queue page | Statistics displayed | Medium |
| FE-WQ-011 | Flowable fallback message | Flowable unavailable | 1. View work queue | Fallback message displayed | Medium |

### 6.2 Task Actions
| TC ID | Test Case | Preconditions | Test Steps | Expected Result | Priority |
|-------|-----------|---------------|------------|------------------|----------|
| FE-WQ-012 | Self-assign task | Task is UNASSIGNED, user is INVESTIGATOR | 1. Click "Assign to Me" | Task assigned, status updated | High |
| FE-WQ-013 | Assign task to user | Task is UNASSIGNED, user is SUPERVISOR | 1. Click "Assign"<br>2. Select user<br>3. Confirm | Task assigned, status updated | High |
| FE-WQ-014 | View task details | Task exists | 1. Click task in table | Task details modal opens | High |
| FE-WQ-015 | Complete task | Task is ASSIGNED to user | 1. Open task<br>2. Click "Complete"<br>3. Confirm | Task completed, status updated | High |
| FE-WQ-016 | Reassign task | Task is ASSIGNED, user is SUPERVISOR | 1. Open task<br>2. Click "Reassign"<br>3. Select new user<br>4. Confirm | Task reassigned | High |
| FE-WQ-017 | Unassign task | Task is ASSIGNED | 1. Open task<br>2. Click "Unassign"<br>3. Enter reason<br>4. Confirm | Task unassigned, returns to queue | High |
| FE-WQ-018 | Reassign to different queue | Task exists, user is SUPERVISOR | 1. Open task<br>2. Click "Reassign Queue"<br>3. Select queue<br>4. Confirm | Task moved to new queue | Medium |
| FE-WQ-019 | Action button visibility | Task is UNASSIGNED | 1. View task | Appropriate actions visible | High |

---

## 7. Reports

### 7.1 Report Pages
| TC ID | Test Case | Preconditions | Test Steps | Expected Result | Priority |
|-------|-----------|---------------|------------|------------------|----------|
| FE-RPT-001 | Reports page loads | User is logged in | 1. Navigate to /reports | Reports page displayed | High |
| FE-RPT-002 | Report type selection | - | 1. View reports page | Report types listed | High |
| FE-RPT-003 | Case status report | User has permission | 1. Select "Case Status Report"<br>2. View report | Report data displayed | High |
| FE-RPT-004 | Investigator workload report | User has permission | 1. Select "Workload Report"<br>2. View report | Workload data displayed | Medium |
| FE-RPT-005 | Case ageing report | User has permission | 1. Select "Ageing Report"<br>2. View report | Ageing data displayed | Medium |
| FE-RPT-006 | Audit logs report | User has permission | 1. Select "Audit Logs"<br>2. View report | Audit log data displayed | Medium |
| FE-RPT-007 | Report filters | Report exists | 1. Apply filters (date range, case type) | Filtered report data shown | High |
| FE-RPT-008 | Report export | Report data exists | 1. Click "Export" button | Report exported (PDF/Excel) | Medium |
| FE-RPT-009 | Report charts/graphs | Report data exists | 1. View report | Charts/graphs rendered | Medium |
| FE-RPT-010 | Report loading state | - | 1. Select report | Loading indicator shown | Medium |
| FE-RPT-011 | Report error state | API error | 1. Select report | Error message displayed | Medium |

### 7.2 Fraud Report
| TC ID | Test Case | Preconditions | Test Steps | Expected Result | Priority |
|-------|-----------|---------------|------------|------------------|----------|
| FE-RPT-012 | Generate fraud report | Case exists | 1. Open case<br>2. Click "Generate Report"<br>3. Fill form<br>4. Submit | Report generated, success message | High |
| FE-RPT-013 | View fraud report | Report exists | 1. Open case<br>2. View reports tab | Report list displayed | High |
| FE-RPT-014 | Edit fraud report | Report exists, user has permission | 1. Open report<br>2. Click "Edit"<br>3. Update fields<br>4. Save | Report updated, success message | High |
| FE-RPT-015 | Approve fraud report | Report exists, user is SUPERVISOR | 1. Open report<br>2. Click "Approve"<br>3. Select outcome<br>4. Submit | Report approved, archived | High |
| FE-RPT-016 | Report version locking | Report being edited | 1. User A opens report<br>2. User B tries to edit | User B sees lock message | Medium |

---

## 8. Admin Dashboard

### 8.1 Admin Features
| TC ID | Test Case | Preconditions | Test Steps | Expected Result | Priority |
|-------|-----------|---------------|------------|------------------|----------|
| FE-ADMIN-001 | Admin dashboard loads | User has ADMIN role | 1. Navigate to /admin | Admin dashboard displayed | High |
| FE-ADMIN-002 | Work queue management | User has ADMIN role | 1. View admin dashboard<br>2. Open work queue management | Work queue management interface | High |
| FE-ADMIN-003 | Create work queue | User has ADMIN role | 1. Click "Create Queue"<br>2. Fill form<br>3. Submit | Work queue created | Medium |
| FE-ADMIN-004 | Edit work queue | Work queue exists | 1. Click "Edit" on queue<br>2. Update fields<br>3. Save | Work queue updated | Medium |
| FE-ADMIN-005 | Delete work queue | Work queue exists | 1. Click "Delete" on queue<br>2. Confirm | Work queue deleted | Medium |
| FE-ADMIN-006 | Work queue table | Work queues exist | 1. View work queue management | Work queues table displayed | High |
| FE-ADMIN-007 | Admin access restriction | User without ADMIN role | 1. Navigate to /admin | Access denied or redirect | High |

---

## 9. Evidence Management

### 9.1 Evidence Display
| TC ID | Test Case | Preconditions | Test Steps | Expected Result | Priority |
|-------|-----------|---------------|------------|------------------|----------|
| FE-EVID-001 | Evidence list displays | Evidence exists | 1. Open case/task<br>2. View evidence tab | Evidence list displayed | High |
| FE-EVID-002 | Evidence information | Evidence exists | 1. View evidence list | Evidence details shown (type, date, uploader) | High |
| FE-EVID-003 | Evidence type badges | Evidence with types | 1. View evidence list | Type badges displayed | Medium |
| FE-EVID-004 | Evidence registry page | Evidence exists | 1. Navigate to /evidence | Evidence registry page displayed | Medium |

### 9.2 Evidence Upload
| TC ID | Test Case | Preconditions | Test Steps | Expected Result | Priority |
|-------|-----------|---------------|------------|------------------|----------|
| FE-EVID-005 | Upload evidence file | Task exists | 1. Open task<br>2. Click "Upload Evidence"<br>3. Select file<br>4. Fill form<br>5. Submit | Evidence uploaded, success message | High |
| FE-EVID-006 | Upload multiple files | Task exists | 1. Open upload modal<br>2. Select multiple files<br>3. Submit | All files uploaded | High |
| FE-EVID-007 | Upload form validation | - | 1. Open upload modal<br>2. Submit without file | Validation error displayed | High |
| FE-EVID-008 | File size validation | - | 1. Select file > 100MB<br>2. Submit | File size error displayed | High |
| FE-EVID-009 | File type validation | - | 1. Select invalid file type<br>2. Submit | File type error displayed | Medium |
| FE-EVID-010 | Upload progress indicator | Large file | 1. Upload large file | Progress bar displayed | Medium |
| FE-EVID-011 | Evidence type selection | Task exists | 1. Open upload modal<br>2. Select evidence type | Type selected correctly | High |

### 9.3 Evidence Actions
| TC ID | Test Case | Preconditions | Test Steps | Expected Result | Priority |
|-------|-----------|---------------|------------|------------------|----------|
| FE-EVID-012 | Download evidence | Evidence exists | 1. Click "Download" on evidence | File downloads | High |
| FE-EVID-013 | View evidence | Evidence exists | 1. Click "View" on evidence | Evidence viewer opens | Medium |
| FE-EVID-014 | Verify evidence | Evidence exists | 1. Click "Verify" on evidence | Verification result displayed | Low |
| FE-EVID-015 | Filter evidence by type | Evidence exists | 1. Select type filter | Filtered evidence shown | Medium |

---

## 10. UI/UX Components

### 10.1 Common Components
| TC ID | Test Case | Preconditions | Test Steps | Expected Result | Priority |
|-------|-----------|---------------|------------|------------------|----------|
| FE-UI-001 | Modal open/close | - | 1. Click button to open modal<br>2. Click close/X | Modal opens/closes smoothly | High |
| FE-UI-002 | Toast notifications | Action performed | 1. Perform action (e.g., create case) | Success/error toast displayed | High |
| FE-UI-003 | Loading spinners | API call in progress | 1. Trigger action | Loading spinner displayed | Medium |
| FE-UI-004 | Error messages | Error occurs | 1. Trigger error | Error message displayed clearly | High |
| FE-UI-005 | Form validation | Form exists | 1. Submit invalid form | Validation errors shown inline | High |
| FE-UI-006 | Dropdown menus | - | 1. Click dropdown | Menu opens, options selectable | Medium |
| FE-UI-007 | Date picker | - | 1. Click date field | Date picker opens, date selectable | Medium |
| FE-UI-008 | Search input | - | 1. Type in search field | Search results update in real-time | Medium |
| FE-UI-009 | Pagination controls | Multiple pages exist | 1. Click page number/next/prev | Correct page loaded | High |
| FE-UI-010 | Table sorting | Table exists | 1. Click column header | Table sorted by column | Medium |
| FE-UI-011 | Badge/status indicators | Items with statuses | 1. View items | Status badges displayed with colors | Medium |
| FE-UI-012 | Tooltips | Elements with tooltips | 1. Hover over element | Tooltip displayed | Low |
| FE-UI-013 | Confirmation dialogs | Destructive action | 1. Click delete/abandon | Confirmation dialog appears | High |
| FE-UI-014 | Empty states | No data exists | 1. View empty list | Empty state message displayed | Medium |
| FE-UI-015 | Skeleton loaders | - | 1. Navigate to page | Skeleton loader shown during load | Medium |

---
