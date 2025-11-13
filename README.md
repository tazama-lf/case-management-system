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
# Install all dependencies (root, frontend, and backend)
npm run install:all
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

### 5. CouchDB Setup (Evidence Storage)

CouchDB is used for storing evidence files with tamper-proof integrity validation.

#### Using Docker (Recommended)
```bash
# Start CouchDB container
docker-compose up couchdb -d

# Verify CouchDB is running
docker ps | grep couchdb
```

CouchDB will be available at:
- **URL**: `http://localhost:5984`
- **Admin UI**: `http://localhost:5984/_utils`
- **Default Credentials**: `simon:1234` (configurable in `.env`)

#### Manual CouchDB Configuration

**First-time setup:**
1. Copy the template configuration:
   ```bash
   cp docker/couchdb/local.ini.example docker/couchdb/local.ini
   ```

2. Edit `docker/couchdb/local.ini` with your settings:
   ```ini
   [couchdb]
   single_node=true
   uuid = c4cec7872572187d7f74056c179e5309  # Generate unique UUID

   [httpd]
   enable_cors = true
   max_http_request_size = 4294967296  # 4GB max file size

   [chttpd]
   bind_address = 0.0.0.0
   port = 5984

   [admins]
   # Add your admin credentials (CouchDB auto-hashes on first start)
   your_username = your_password

   [chttpd_auth]
   secret = your-random-secret-here  # Generate secure random string
   ```

3. **Important:** The `local.ini` file contains sensitive credentials and is gitignored. Never commit it to version control.

#### Setting Up Custom Credentials

To change the default CouchDB credentials:

1. **Update `docker-compose.yml`:**
   ```yaml
   couchdb:
     environment:
       COUCHDB_USER: your_username
       COUCHDB_PASSWORD: "your_password"
   ```

2. **Update `backend/.env`:**
   ```env
   COUCHDB_URL=http://localhost:5984
   COUCHDB_USERNAME=your_username
   COUCHDB_PASSWORD=your_password
   COUCHDB_DATABASE=evidence_store
   ```

3. **Restart CouchDB:**
   ```bash
   docker-compose down couchdb
   docker-compose up couchdb -d
   ```

#### Verifying CouchDB Setup

1. **Access Admin UI:**
   - Open `http://localhost:5984/_utils` in your browser
   - Login with your credentials (default: `simon:1234`)
   - You should see the CouchDB Fauxton interface

2. **Check Database Creation:**
   - The `evidence_store` database is created automatically
   - You can view it in the Fauxton interface under "Databases"

3. **Test Connection from Backend:**
   ```bash
   # Check backend logs for CouchDB connection
   docker-compose logs backend | grep -i couchdb
   
   # Should see: "Connected to CouchDB database: evidence_store"
   ```

#### Troubleshooting CouchDB

**Connection refused errors:**
```bash
# Check if CouchDB container is running
docker ps | grep couchdb

# View CouchDB logs
docker logs tazama-cms-couchdb

# Restart CouchDB
docker-compose restart couchdb
```

**Authentication errors:**
- Verify credentials match in `docker-compose.yml` and `.env`
- Check `docker/couchdb/local.ini` admin section
- Ensure password is properly escaped in environment variables

**Port conflicts:**
If port 5984 is already in use:
1. Update `docker-compose.yml`: `"5985:5984"`
2. Update `backend/.env`: `COUCHDB_URL=http://localhost:5985`

### 6. Start Development Servers
```bash
# From root directory - starts both frontend and backend
npm run dev

# Or start individually:
npm run dev:backend   # Backend at http://localhost:3000
npm run dev:frontend  # Frontend at http://localhost:5173
```

---

# Authentication Flow

## Overview

This project uses a secure, centralized authentication flow leveraging Keycloak, the Tazama Auth Service, and JWT-based authorization in the CMS backend.

## Authentication Sequence Diagram

```mermaid
sequenceDiagram
    participant User as User (Frontend/API Client)
    participant AuthService as Tazama Auth Service
    participant Keycloak as Keycloak
    participant CMS as CMS Backend

    User->>AuthService: 1. POST /v1/auth/login (username, password)
    AuthService->>Keycloak: 2. Validate credentials
    alt Invalid credentials
        Keycloak-->>AuthService: Error (invalid)
        AuthService-->>User: 401 Unauthorized
    else Valid credentials
        Keycloak-->>AuthService: Success (user info)
        AuthService-->>User: 3. JWT Token (Tazama format)
        User->>CMS: 4. API Request with Authorization: Bearer <JWT>
        CMS->>CMS: 5. Verify JWT (using public key)
        CMS->>CMS: 6. Extract claims (role, permissions, tenantId)
        CMS->>CMS: 7. Enforce RBAC, tenant isolation, audit logging
        CMS-->>User: 8. Response (data or error)
    end
```

---

## Project Structure

```
case-management-system/
├── backend/                 # NestJS API server
│   ├── src/                 # Source code
│   ├── prisma/              # Database schema and migrations
│   ├── test/                # Backend tests
│   └── .env.example         # Environment variables template
├── frontend/                # React frontend application
│   ├── src/                 # Source code
│   ├── public/              # Static assets
│   └── .env.example         # Environment variables template
├── docker-compose.yml       # Docker services configuration
└── package.json             # Monorepo scripts and dependencies
```

---

## Development Commands

### Monorepo Commands (from root)
```bash
# Development
npm run dev                  # Start both frontend and backend
npm run dev:backend          # Start only backend
npm run dev:frontend         # Start only frontend

# Building
npm run build               # Build both applications
npm run build:backend       # Build backend only
npm run build:frontend      # Build frontend only

# Testing
npm run test               # Run all tests
npm run test:backend       # Run backend tests
npm run test:frontend      # Run frontend tests

# Linting
npm run lint               # Lint both applications
npm run lint:backend       # Lint backend only
npm run lint:frontend      # Lint frontend only

# Installation
npm run install:all        # Install all dependencies
npm run install:backend    # Install backend dependencies
npm run install:frontend   # Install frontend dependencies
```

```

### Backend Commands (from backend/)

```bash
# Development
npm run start:dev          # Start with hot reload
npm run start:debug        # Start with debugging
npm run start:prod         # Production mode

# Database
npx prisma migrate dev     # Run migrations
npx prisma generate        # Generate Prisma client
npx prisma studio          # Open database GUI

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
- **Accessibility Tests**: Keyboard navigation and screen reader support
- **Performance Tests**: Virtual scrolling and large dataset handling

---

## Deployment

### Environment Variables

#### Backend (.env)
```bash
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/database"

# CouchDB (Evidence Storage)
COUCHDB_URL=http://localhost:5984
COUCHDB_USERNAME=simon
COUCHDB_PASSWORD=1234
COUCHDB_DATABASE=evidence_store

# Authentication
TAZAMA_AUTH_URL=http://localhost:3020/v1/auth/login
AUTH_PUBLIC_KEY_PATH=public-key.pem

# Alert Configuration
TRIAGE_TYPE=MANUAL                    # AI, MANUAL, or DISABLED
CONFIDENCE_THRESHOLD=95
CLIENT_SYSTEM_INTERDICTION_ENABLED=true

# NATS Messaging
SERVER_URL=nats://localhost:4222
NODE_ENV=production
```

#### Frontend (.env)
```bash
# API Configuration
VITE_API_BASE_URL=http://localhost:3000
VITE_APP_NAME=Tazama Case Management System
VITE_APP_VERSION=0.0.1
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

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow TypeScript and ESLint configurations
- Write tests for new features
- Update documentation for API changes
- Follow conventional commit messages

---

## API Documentation

The backend API provides RESTful endpoints for:
- **Authentication**: Login, token refresh, logout
- **Alerts**: CRUD operations, filtering, manual triage
- **Cases**: Case management and investigation workflows
- **Comments**: Add notes and observations to cases
- **Tasks**: Task assignment and tracking
- **Audit**: Comprehensive audit logging

### Key Endpoints
- `POST /api/v1/auth/login` - User authentication
- `GET /api/v1/triage/alerts` - Fetch alerts with filtering
- `PATCH /api/v1/triage/alerts/:id` - Manual triage
- `GET /api/v1/cases` - List cases
- `POST /api/v1/cases` - Create new case

---

## Security

- **JWT Authentication**: Secure token-based authentication
- **Role-Based Access Control**: Fine-grained permissions
- **Tenant Isolation**: Multi-tenant data separation
- **Audit Logging**: Comprehensive activity tracking
- **Input Validation**: Request validation and sanitization

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
- **PostgreSQL** - Primary database (metadata storage)
- **CouchDB** - Document database (evidence file storage)
- **JWT** - Authentication tokens
- **Jest** - Testing framework

### Infrastructure
- **Docker** - Containerization
- **NATS** - Message broker
- **Keycloak** - Identity provider

---

## Support

For support and questions:
- Create an issue in the GitHub repository
- Check the documentation and API guides
- Review existing issues and discussions
