# Tazama Case and Investigation Management System

Tazama Case and Investigation Management System is a comprehensive solution for managing cases and investigations efficiently. This project aims to streamline workflows, improve collaboration, and provide robust tools for tracking, reporting, and analyzing case data.

---
# Tazama Case Management System – Authentication Flow

## Overview

This project uses a secure, centralized authentication flow leveraging Keycloak, the Tazama Auth Service, and JWT-based authorization in the CMS backend.  
Below is a sequence diagram and explanation of how authentication and authorization work in this system.

---

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

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

