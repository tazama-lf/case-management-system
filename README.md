# Tazama Case and Investigation Management System

Tazama Case and Investigation Management System is a comprehensive solution for managing cases and investigations efficiently. This project aims to streamline workflows, improve collaboration, and provide robust tools for tracking, reporting, and analyzing case data.

## Architecture

This is a monorepo containing:

- **Frontend**: React + TypeScript + Vite application with Tailwind CSS
- **Backend**: NestJS + TypeScript API with PostgreSQL database
- **Authentication**: Keycloak-based authentication with JWT tokens

---

## Quick Start

### Prerequisites

- Node.js 18+
- npm 9+
- PostgreSQL database
- Keycloak server (for authentication)

### 1. Clone the Repository

```bash
git clone https://github.com/tazama-lf/case-management-system.git
cd case-management-system
```

### 2. Install Dependencies

```bash
# For Backend
cd backend
npm install

# For Frontend
cd frontend
npm install
```

### 3. Environment Setup

```bash
# Copy environment examples
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Edit the environment files with your configurations
# backend/.env - Configure database, auth, and services
# frontend/.env - Configure API endpoints
```

### 4. Database Setup

```bash
# Navigate to backend and run migrations
cd backend
npx prisma migrate dev
npx prisma generate
```

### 5. Start Development Servers

```bash
cd backend
npm run start:dev

cd frontend
npm run dev
```

---

# Authentication Flow

## Overview

This project uses a secure, centralized authentication flow leveraging Keycloak, the Tazama Auth Service, and JWT-based authorization in the CMS backend.

---

## Project Structure

```
case-management-system/
├── backend/                        # NestJS API server
│   ├── src/                        # Source code
│   │   ├── config/                 # App configuration
│   │   ├── constants/              # Shared constants
│   │   ├── decorators/             # Custom decorators
│   │   ├── dtos/                   # Data transfer objects
│   │   ├── guards/                 # Auth & access guards
│   │   ├── interceptors/           # NestJS interceptors
│   │   ├── logger/                 # Logging utilities
│   │   ├── modules/                # Feature modules
│   │   │   ├── admin/
│   │   │   ├── alert/
│   │   │   ├── alert-priority/
│   │   │   ├── async-task/
│   │   │   ├── audit/
│   │   │   ├── auth/
│   │   │   ├── bpmn/
│   │   │   ├── case/
│   │   │   ├── case_history/
│   │   │   ├── comment/
│   │   │   ├── couchdb/
│   │   │   ├── events/
│   │   │   ├── evidence/
│   │   │   ├── filter/
│   │   │   ├── flowable/
│   │   │   ├── notification/
│   │   │   ├── report/
│   │   │   ├── task/
│   │   │   ├── tazama-dwh/
│   │   │   ├── triage/
│   │   │   └── user/
│   │   └── utils/                  # Utility helpers
│   ├── prisma/                     # Primary DB schema and migrations
│   ├── prismaDWH/                  # Data warehouse schema and migrations
│   ├── test/                       # Backend unit & e2e tests
│   └── .env.example                # Environment variables template
├── frontend/                       # React frontend application
│   ├── src/                        # Source code
│   │   ├── features/               # Feature-based modules
│   │   │   ├── admin/
│   │   │   ├── alerts/
│   │   │   ├── auth/
│   │   │   ├── cases/
│   │   │   ├── dashboard/
│   │   │   └── reports/
│   │   ├── shared/                 # Shared components, hooks, utils
│   │   │   ├── components/
│   │   │   ├── config/
│   │   │   ├── constants/
│   │   │   ├── hooks/
│   │   │   ├── interfaces/
│   │   │   ├── providers/
│   │   │   ├── services/
│   │   │   ├── types/
│   │   │   └── utils/
│   │   └── router/                 # App routing
│   ├── public/                     # Static assets
│   └── .env.example                # Environment variables template
├── docker/                         # Docker service configs (e.g. CouchDB)
├── notebooks/                      # Jupyter notebooks for data analysis
├── src/                            # Shared audit utilities
├── docker-compose-cms.yml          # CMS services Docker Compose
├── docker-compose-infra.yml        # Infrastructure Docker Compose
└── README.md
```

---

## Development Commands

### Backend Commands (from backend/)

```bash
# Development
npm run start:dev          # Start with hot reload
npm run start:debug        # Start with debugging
npm run start:prod         # Production mode

# Database
npx prisma migrate dev     # Run migrations
npx prisma generate        # Generate Prisma client

# Testing
npm run test              # Unit tests
npm run test:watch        # Unit tests in watch mode
npm run test:e2e          # End-to-end tests
npm run test:cov          # Test coverage

# Linting & Formatting
npm run lint              # Check linting
npm run fix               # Fix linting issues
npm run format            # Format code

```

### Frontend Commands (from frontend/)

```bash
# Development
npm run dev               # Start development server
npm run build             # Build for production
npm run preview           # Preview production build

# Testing
npm run test              # Run tests in watch mode
npm run test:run          # Run tests once
npm run test:ui           # Visual test interface
npm run test:coverage     # Generate coverage report

# Linting
npm run lint              # Check linting issues
```

---

## Testing

### Backend Testing

- **Unit Tests**: Jest-based tests for services, controllers, and utilities
- **E2E Tests**: Full application testing with test database
- **Coverage Reports**: Comprehensive test coverage analysis

### Frontend Testing

- **Unit Tests**: Vitest for component and hook testing
- **Integration Tests**: API integration and provider testing

---

## Deployment

### Environment Variables

#### Backend (.env)

```bash
# Database
POSTGRES_DB=tazama_cms
POSTGRES_USER=postgres
POSTGRES_PASSWORD=unused
POSTGRES_HOST=tazama-postgres-1
POSTGRES_PORT=5432
DATABASE_URL="postgresql://postgres:unused@tazama-postgres-1:5432/tazama_cms"
DWH_DATABASE_URL="postgresql://postgres:unused@tazama-postgres-1:5432/tazama_dwh"

# Authentication
TAZAMA_AUTH_URL=http://localhost:3020/v1/auth
AUTH_PUBLIC_KEY_PATH=public.pem
CERT_PATH_PUBLIC=public.pem

# Alert Configuration
TRIAGE_TYPE=MANUAL                    # AI, MANUAL, or DISABLED
CONFIDENCE_THRESHOLD=95
CLIENT_SYSTEM_INTERDICTION_ENABLED=true
SYSTEM_UUID=a9a8ff94-c7e4-4e6c-b421-e6d5d75a76e1

# Flowable Configuration
FLOWABLE_URL=http://tazama-cms-flowable:8080/flowable-rest
FLOWABLE_USERNAME=rest-admin
FLOWABLE_PASSWORD=test
SPRING_DATASOURCE_DRIVER=org.postgresql.Driver
SPRING_DATASOURCE_URL=jdbc:postgresql://tazama-postgres-1:5432/flowable
SPRING_DATASOURCE_USERNAME=postgres
SPRING_DATASOURCE_PASSWORD=unused

# NATS Messaging
SERVER_URL=nats://nats:4222
STARTUP_TYPE=nats
NODE_ENV=dev
FUNCTION_NAME=case-management-service
PRODUCER_STREAM=default
CONSUMER_STREAM=investigation-service

# Performance
MAX_CPU=1

# Redis
REDIS_HOST=tazama-valkey-1
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Alert Priority
PRIORITY_FIRST_HALF=0.33
PRIORITY_SECOND_HALF=0.66
PRIORITY_THIRD_HALF=1.0
DEFAULT_SLA_HOURS=72
ALERT_PRIORITY_CRON_SCHEDULE="0 * * * *"

# Auto-assignment
AUTO_ASSIGNMENT_ENABLED=false

# Email Service
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="user@example.com"
SMTP_PASS="your-smtp-password"
MAIL_FROM="user@example.com"

# CouchDB Configuration
COUCHDB_URL=http://couchdb:5984
COUCHDB_DATABASE=cms-evidence
COUCHDB_USER=admin
COUCHDB_PASSWORD=password

# Audit / OpenSearch Configuration
AUDIT_PROVIDER=opensearch
OPENSEARCH_NODE=http://localhost:9200
OPENSEARCH_USERNAME=admin
OPENSEARCH_PASSWORD=admin
OPENSEARCH_SSL_REJECT_UNAUTHORIZED=false
OPENSEARCH_REFRESH=false
```

#### Frontend (.env)

```bash
# API Configuration
VITE_API_BASE_URL=http://localhost:3090
VITE_APP_NAME=Tazama Case Management System
VITE_APP_VERSION=0.0.1

# Security
VITE_CRYPTO_KEY=your-crypto-key

# Jupyter / Voilà
VITE_VOILA_URL=http://localhost:8866
```

### Docker Deployment

```bash
# Build and start all services
docker-compose up -d

# Build specific service
docker-compose build backend
docker-compose build frontend

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend
```
Please refer to the deployment guide here: https://github.com/tazama-lf/docs/blob/dev/Technical/Deployment-Guides/CMS-Deployment-Guide.md

---

## API Documentation

The backend exposes an interactive Swagger UI for exploring and testing all available REST endpoints. To access it, start the backend server as described in the [Quick Start](#quick-start) guide, then navigate to:

**http://localhost:3090/api/docs**

The documentation is automatically generated from the source code and reflects the current state of the API, including request/response schemas, authentication requirements, and available operations.

---

## Features

### Alert Management

- Real-time alert processing and triage
- Manual and AI-powered decision making
- Risk scoring and typology analysis
- Source and time-based filtering

### Case Investigation

- Complete case lifecycle management
- Task assignment and tracking
- Comment and documentation system
- Investigation workflow automation

### Reporting & Analytics

- Comprehensive audit trails
- Performance metrics and analytics
- Custom reporting capabilities
- Data export functionality

---

## Technology Stack

### Frontend

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first styling
- **TanStack Query** - Server state management
- **React Router** - Navigation
- **Vitest** - Testing framework

### Backend

- **NestJS** - Node.js framework
- **TypeScript** - Type safety
- **Prisma** - Database ORM
- **PostgreSQL** - Primary database
- **JWT** - Authentication tokens
- **Jest** - Testing framework

### Infrastructure

- **Docker** - Containerization
- **NATS** - Message broker
- **Keycloak** - Identity provider

---

# For support or questions
- Review existing issues, discussions and pull requests
- Start a discussion in the **Discussions** tab or create an issue in the **Issues** tab in this repository
- Join the Tazama Slack workspace and post your question in the **#get-help** channel - :point_right: Join here: https://slack.tazama.org
