# Tazama Case and Investigation Management System (CMS)

Tazama Case and Investigation Management System (CMS) is the investigation workspace of the Tazama ecosystem. It receives every transaction evaluation result from Tazama core, turns alerts into cases, and guides investigators, supervisors and compliance officers through triage, investigation, approval and regulatory filing, with full audit trails and SLA tracking.

**What CMS is:**
- An alert intake service that consumes Tazama evaluation results (`ALRT` / `NALT`) from NATS
- An alert triage module supporting manual, AI-assisted or disabled triage
- A case lifecycle engine backed by a Flowable BPMN workflow, with maker-checker approvals for case creation, closure and reopening
- A task management system with work queues, assignment, reassignment and SLA escalation
- A case-level access control system (allowlist, blocklist and revoke) managed by supervisors
- An evidence management system with encrypted document storage in CouchDB
- An investigation workspace with visualizations (alert navigator, transaction history, network analysis, alert history, conditions) served from the BIAR data lakehouse
- A reporting module for case status, investigator workload, case ageing and fraud investigation reports
- A multi-tenant platform with role-based access control (Investigator, Supervisor, Compliance Officer, Admin)

## User Manual and Video Demonstration

- Please refer to the user manual here: https://github.com/tazama-lf/docs/blob/dev/Guides/User%20Manuals%20for%20Downloading/Tazama%20Case%20Management%20System%20-%20User%20Manual.docx

## Architecture

### High-Level Flow

```mermaid
flowchart LR
    A["⚖️ Tazama Event Adjudicator"]
    B["📨 NATS"]
    C["⚙️ CMS Backend API"]
    D["🖥️ CMS Frontend"]
    E[("🗄️ PostgreSQL")]
    F["🔁 Flowable BPMN"]
    G[("📁 CouchDB Evidence")]
    H["📊 BIAR Datalakehouse API"]

    A --> B --> C
    D <--> C
    C <--> E
    C <--> F
    C <--> G
    C --> H

    style A fill:#e3f2fd,stroke:#1565c0,stroke-width:2px,color:#000
    style B fill:#fce4ec,stroke:#c62828,stroke-width:2px,color:#000
    style C fill:#fff8e1,stroke:#f57f17,stroke-width:2px,color:#000
    style D fill:#e3f2fd,stroke:#1565c0,stroke-width:2px,color:#000
    style E fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px,color:#000
    style F fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px,color:#000
    style G fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px,color:#000
    style H fill:#e0f7fa,stroke:#00838f,stroke-width:2px,color:#000
```

This is a monorepo containing:

- **Frontend**: React + TypeScript + Vite application with Tailwind CSS
- **Backend**: NestJS + TypeScript API with Prisma and PostgreSQL
- **Notebooks**: Jupyter notebooks rendered by Voilà and embedded in the case Visualizations tab

---

## Quick Start

### Prerequisites

- Node.js 22+ (LTS recommended)
- npm 9+
- Docker & Docker Compose
- A running Tazama core with NATS, the Tazama Auth Service and Keycloak
- The Tazama Auth Service public key (`public.pem`)
- OpenSearch (audit log)

### 1. Clone the Repository

```bash
git clone https://github.com/tazama-lf/case-management-system.git
cd case-management-system
```

### 2. Backend Setup

```bash
cd backend

# Add GH_TOKEN to .npmrc, then install dependencies
npm install

# Create environment file
cp .env.example .env

# Configure database and services in .env
# Key variables:
# - DATABASE_URL, REDIS_*, SERVER_URL (NATS)
# - TAZAMA_AUTH_URL, AUTH_PUBLIC_KEY_PATH
# - FLOWABLE_URL, COUCHDB_*, OPENSEARCH_*
# - GOLD_LAKEHOUSE_API_URL (BIAR), VOILA_URL, VOILA_BASE_URL
# - PRIORITY_FIRST_HALF, PRIORITY_SECOND_HALF, PRIORITY_THIRD_HALF, DEFAULT_SLA_HOURS
#   (required at start-up but missing from .env.example)

# Generate the Prisma client
npx prisma generate

# Start development server
npm run start:dev

# Backend API available at http://localhost:3090
# Swagger docs at http://localhost:3090/api/docs
```

### 3. Frontend Setup

```bash
cd frontend

npm install

# Create environment file
cp .env.example .env

# Configure API endpoint in .env
# Key variables:
# - VITE_API_BASE_URL (backend API, e.g. http://localhost:3090)
# - VITE_CRYPTO_KEY

# Start development server
npm run dev

# Frontend available at http://localhost:5175
```

### 4. Docker Compose Setup

```bash
# From root directory, start PostgreSQL, Valkey and NATS
docker compose -f docker-compose-infra.yml up -d

# Then start CMS
docker compose -f docker-compose-cms.yml up -d

# This starts:
# - migrate (creates the tazama_cms and flowable databases, runs migrations, seeds reference IDs)
# - CouchDB (port 5984)
# - Flowable (port 8081)
# - Backend API (port 3090)
# - Frontend
# - Voilà notebook server (internal port 8866)
```

To run the backend locally against containers, start only the dependencies with `docker compose -f docker-compose-cms.yml up -d migrate couchdb flowable` and point `backend/.env` at the published host ports.

---

## Project Structure

### Root Directory

```
case-management-system/
├── backend/                              # NestJS API server
│   ├── prisma/
│   │   ├── schema.prisma                # Database schema
│   │   ├── migrations/                  # Prisma migrations
│   │   └── scripts/                     # One-off backfill and rollback SQL scripts
│   ├── src/
│   │   ├── config/                      # Env validation, CORS, security headers
│   │   ├── constants/                   # Shared constants
│   │   ├── decorators/                  # Auth and user decorators
│   │   ├── guards/                      # Tazama token validation
│   │   ├── interpectors/                # Audit log and token expiry interceptors
│   │   ├── modules/                     # Feature modules
│   │   │   ├── alert/                   # Alerts
│   │   │   ├── alert-priority/          # Priority and hourly SLA escalation
│   │   │   ├── bpmn/                    # cms.bpmn20.xml workflow definition
│   │   │   ├── case/                    # Case lifecycle and approvals
│   │   │   ├── case-investigator/       # Case access control (allowlist, blocklist)
│   │   │   ├── evidence/                # Evidence upload and download (CouchDB)
│   │   │   ├── flowable/                # Flowable client and listeners
│   │   │   ├── gold-lakehouse/          # BIAR Datalakehouse API client
│   │   │   ├── nats/                    # NATS alert consumer
│   │   │   ├── process-alert/           # Alert ingestion
│   │   │   ├── report/                  # Reports
│   │   │   ├── task/                    # Tasks and assignment
│   │   │   ├── triage/                  # Manual and AI triage
│   │   │   ├── voila-proxy/             # Authenticated proxy to Voilà
│   │   │   └── ...                      # admin, auth, comment, notification, user, etc.
│   │   └── utils/                       # RBAC permission matrix and helpers
│   ├── test/                            # Unit tests
│   ├── test-alerts/                     # Sample alert payloads
│   ├── migrate.sh                       # Database creation, migration and seeding
│   └── .env.example                     # Environment variables template
├── frontend/                             # React frontend application
│   ├── src/
│   │   ├── features/                    # admin, alerts, auth, cases, dashboard, reports
│   │   ├── shared/                      # Shared components, hooks, services, utils
│   │   └── router/                      # App routing
│   └── .env.example                     # Environment variables template
├── notebooks/                            # Voilà visualization notebooks
├── docker/couchdb/                       # CouchDB configuration
├── docker-compose-cms.yml                # CMS services
├── docker-compose-infra.yml              # PostgreSQL, Valkey and NATS
└── Dockerfile.voila                      # Voilà notebook server image
```

---

## Development Commands

### Backend Commands (from `backend/`)

```bash
# Development
npm run start:dev        # Start with hot reload
npm run start:debug      # Start with debugging
npm run start:prod       # Production mode
npm run build            # Build

# Database
npx prisma generate      # Generate Prisma client
npx prisma migrate dev   # Create and apply a migration (development)
npx prisma migrate deploy # Apply migrations (deployment)

# Linting & Formatting
npm run lint             # ESLint + Prettier check
npm run fix              # Auto-fix all issues
npm run format           # Format code
```

### Frontend Commands (from `frontend/`)

```bash
# Development
npm run dev              # Start development server
npm run build            # Build for production
npm run preview          # Preview production build

# Linting & Formatting
npm run lint             # ESLint + Prettier check
npm run fix              # Auto-fix all issues
```

---

## Testing

### Backend Testing

- **Unit Tests**: Jest-based service, controller and utility tests
- **Tools**: Jest, ts-jest

```bash
npm run test             # Unit tests
npm run test:watch       # Watch mode
npm run test:cov         # Coverage report
```

### Frontend Testing

- **Unit Tests**: Vitest-based component, hook and service tests
- **Tools**: Vitest, React Testing Library, MSW

```bash
npm run test             # Run tests once
npm run test:watch       # Watch mode
npm run test:ui          # Visual test interface
npm run test:coverage    # Coverage report
```

---

## Deployment

### Environment Variables

#### Backend (`.env`)

```bash
# Application
NODE_ENV=dev
PORT=3090
MAX_CPU=1
SYSTEM_UUID=a9a8ff94-c7e4-4e6c-b421-e6d5d75a76e1

# Database
POSTGRES_DB=tazama_cms
POSTGRES_USER=postgres
POSTGRES_PASSWORD=unused
POSTGRES_HOST=tazama-postgres-1
POSTGRES_PORT=5432
DATABASE_URL="postgresql://postgres:unused@tazama-postgres-1:5432/tazama_cms"

# Authentication
TAZAMA_AUTH_URL=http://localhost:3020/v1/auth
AUTH_PUBLIC_KEY_PATH=public.pem
CERT_PATH_PUBLIC=public.pem
KEYCLOAK_GROUP_NAME=tazama-cms

# Alert Triage
TRIAGE_TYPE=MANUAL                     # MANUAL, AI or DISABLED
CONFIDENCE_THRESHOLD=95
CLIENT_SYSTEM_INTERDICTION_ENABLED=true
AI_MODEL_ENDPOINT=                     # AI triage only

# Priority & SLA (validated at start-up)
PRIORITY_FIRST_HALF=0.33
PRIORITY_SECOND_HALF=0.66
PRIORITY_THIRD_HALF=1.0
DEFAULT_SLA_HOURS=72

# Flowable
FLOWABLE_URL=http://tazama-cms-flowable:8080/flowable-rest
FLOWABLE_USERNAME=rest-admin
FLOWABLE_PASSWORD=test
SPRING_DATASOURCE_DRIVER=org.postgresql.Driver
SPRING_DATASOURCE_URL=jdbc:postgresql://tazama-postgres-1:5432/flowable
SPRING_DATASOURCE_USERNAME=postgres
SPRING_DATASOURCE_PASSWORD=unused

# NATS
SERVER_URL=nats://nats:4222
STARTUP_TYPE=nats
FUNCTION_NAME=case-management-service
PRODUCER_STREAM=default
CONSUMER_STREAM=investigation-service  # Must match the Event Adjudicator's ALERT_PRODUCER

# Redis (Valkey)
REDIS_HOST=tazama-valkey-1
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# CouchDB (all four required)
COUCHDB_URL=http://couchdb:5984
COUCHDB_DATABASE=cms-evidence
COUCHDB_USERNAME=admin
COUCHDB_PASSWORD=password

# Session cookie & CORS (required)
SESSION_COOKIE_SECURE=true             # false only for local HTTP
SESSION_COOKIE_SAMESITE=strict         # strict, lax or none (none requires secure=true)
CORS_ALLOWED_ORIGINS=http://localhost:5175

# Audit (OpenSearch)
AUDIT_PROVIDER=opensearch
OPENSEARCH_NODE=http://localhost:9200
OPENSEARCH_USERNAME=admin
OPENSEARCH_PASSWORD=admin
OPENSEARCH_SSL_REJECT_UNAUTHORIZED=false
OPENSEARCH_REFRESH=false

# Voilà
VOILA_URL=http://voila:8866
VOILA_BASE_URL=http://voila:8866
CASE_MGMT_BACKEND_URL=http://backend:3090   # Read by the Voilà container
CMS_FRONTEND_ORIGIN=http://localhost:5175   # Read by the Voilà container

# BIAR Gold Lakehouse API
GOLD_LAKEHOUSE_API_URL=http://localhost:8282
GOLD_LAKEHOUSE_TIMEOUT=120000

# Email
# SMTP_NOTIFICATIONS (true/false) is required; the service fails to start if it is missing.
# With true, SMTP_HOST and MAIL_FROM must be set, and SMTP_USER/SMTP_PASS set together.
SMTP_NOTIFICATIONS=false
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="user@example.com"
SMTP_PASS="your-smtp-password"
MAIL_FROM="user@example.com"
```

#### Frontend (`.env`)

```bash
VITE_API_BASE_URL=http://localhost:3090
VITE_APP_NAME=Tazama Case Management System
VITE_APP_VERSION=0.0.1
VITE_CRYPTO_KEY=your-crypto-key
```

### Docker Deployment

```bash
# Start infrastructure (PostgreSQL, Valkey, NATS)
docker compose -f docker-compose-infra.yml up -d

# Build and start CMS
docker compose -f docker-compose-cms.yml up -d --build

# View logs
docker compose -f docker-compose-cms.yml logs -f backend

# Stop services
docker compose -f docker-compose-cms.yml down
```

Please refer to the deployment guide here: https://github.com/tazama-lf/docs/blob/dev/Technical/Deployment-Guides/CMS-Deployment-Guide.md

---

## Security

### Frontend Security

- **Session Cookie**: JWT stored in an HttpOnly session cookie with configurable `Secure` / `SameSite` flags
- **Role-Based Routes**: Route protection based on user roles
- **Encrypted Storage**: Sensitive values encrypted before browser storage

### Backend Security

- **JWT Validation**: Signature verification with the Tazama Auth Service public key
- **Role-Based Access Control (RBAC)**: Four roles: `CMS_INVESTIGATOR`, `CMS_SUPERVISOR`, `CMS_COMPLIANCE_OFFICER`, `CMS_ADMIN`
- **Three-Tier Permission Model**: Role assignment → status-based access → status transitions (`src/utils/rbac/permissionMatrix.json`)
- **Case-Level Access Control**: Investigators can only view and modify cases they are on the allowlist for; supervisors can revoke or blocklist users
- **Tenant Isolation**: All data separated by `tenant_id`
- **CORS Allowlist & Security Headers**: Exact-origin CORS and security headers on every response
- **Evidence Encryption**: Evidence files encrypted with AES-256-GCM before storage
- **Authenticated Voilà Proxy**: Notebooks are reachable only through the backend, which validates the user's session
- **Audit Logging**: User actions recorded through the audit interceptor (OpenSearch)

---

## Features

### Alert Management

- **Real-Time Intake**: Alerts consumed from NATS (`investigation-service`) or posted to `POST /ingest-alert`
- **Triage Modes**: Manual, AI-assisted (model confidence and auto-close) or disabled
- **Priority Scoring**: Priority score mapped to LOW, MEDIUM or HIGH using per-tenant thresholds
- **Filtering**: Priority, source, type and date range filters with saved filters

### Case Investigation

- **Case Lifecycle**: Draft → Ready for Assignment → Assigned → In Progress → Pending Final Approval → Closed
- **Approvals**: Supervisor approval for manual case creation, case closure and case reopening
- **Fraud and AML Cases**: A `FRAUD_AND_AML` alert creates linked FRAUD and AML cases in one investigation group
- **Tasks**: Assignment, reassignment, unassignment and status tracking
- **Evidence**: Upload KYC, EDD, Adverse Media, Sanctions and SAR/STR documents
- **Collaboration**: Comments, investigation notes and discussion threads
- **SAR/STR Filing**: Compliance officer task created for cases closed as confirmed

### Access Control

- **Allowlist**: Investigators get access to a case through task assignment
- **Revoke & Blocklist**: Supervisors can revoke or blocklist a user on a case, with a required reason
- **Access History**: Full history of grants, revokes and blocks per case

### SLA & Notifications

- **SLA Tracking**: Per-priority SLA targets with an hourly escalation check
- **Escalations**: Notifications when a case is at risk, due soon or breached
- **Email & In-App Notifications**: Task assignment and case status notifications
- **Real-Time Updates**: Case changes pushed to the browser over WebSockets

### Visualizations (BIAR)

- **Alert Navigator**: Typologies and rules that triggered the alert
- **Transaction Details & History**: Transaction parties and account history, including Benford's law analysis
- **Network Analysis**: Transaction, account and counterparty network graphs
- **Alert History & Conditions**: Previous alerts and block/override conditions

### Reporting & Analytics

- **Dashboard**: Open, available, overdue and resolved case summaries
- **Reports**: Case status, investigator workload, case ageing and evidence findings
- **Fraud Investigation Report**: Generated, edited and approved per case
- **Audit Trail**: Case history, task history and event logs

---

## Technology Stack

### Frontend

- **React 19** — UI framework
- **TypeScript** — Type-safe development
- **Vite 7** — Build tool and dev server
- **Tailwind CSS 4** — Utility-first styling
- **TanStack Query 5** — Server state management
- **React Router 7** — Client-side routing
- **Recharts 3** — Charts and analytics
- **Socket.IO Client** — Real-time case updates
- **Vitest + React Testing Library** — Testing frameworks

### Backend

- **NestJS 11** — Node.js framework
- **TypeScript** — Type-safe development
- **Prisma 6** — Database ORM
- **PostgreSQL** — Primary database
- **Flowable** — BPMN workflow engine
- **Socket.IO + Redis adapter** — WebSocket events
- **@tazama-lf/auth-lib** — Authentication library
- **@tazama-lf/audit-lib** — Audit logging library
- **@tazama-lf/frms-coe-lib / frms-coe-startup-lib** — Logging and NATS startup
- **nano** — CouchDB client
- **Nodemailer** — Email notifications
- **Jest** — Testing framework

### Infrastructure

- **Docker & Docker Compose** — Containerization
- **PostgreSQL** — CMS and Flowable databases
- **Valkey (Redis)** — Cache and WebSocket adapter
- **NATS** — Message broker
- **CouchDB** — Evidence document storage
- **OpenSearch** — Audit log storage
- **Voilà** — Notebook rendering for visualizations
- **Keycloak** — Identity provider (external)
- **BIAR** — Data lakehouse for visualizations (external)

---

# For support or questions

- Review existing issues, discussions and pull requests
- Start a discussion in the **Discussions** tab or create an issue in the **Issues** tab in this repository
- Join the Tazama Slack workspace and post your question in the **#get-help** channel - :point_right: Join here: https://slack.tazama.org

---

## License

Copyright LF Charities, Inc. and contributors to the Tazama project

Licensed under [Apache-2.0](LICENSE)
