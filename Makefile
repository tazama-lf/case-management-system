# =============================================================================
# Makefile for Tazama Case Management System
# =============================================================================

.PHONY: help dev prod build clean test

# Default target
help:
	@echo "Tazama Case Management System - Make Commands"
	@echo ""
	@echo "Development:"
	@echo "  make dev-up      Start development environment"
	@echo "  make dev-down    Stop development environment"
	@echo "  make dev-restart Restart development environment"
	@echo "  make dev-logs    Show development logs"
	@echo ""
	@echo "Production:"
	@echo "  make prod-up     Start production environment"
	@echo "  make prod-down   Stop production environment"
	@echo "  make prod-restart Restart production environment"
	@echo ""
	@echo "Database:"
	@echo "  make db-migrate  Run database migrations"
	@echo "  make db-seed     Seed database"
	@echo "  make db-reset    Reset database"
	@echo "  make db-backup   Backup database"
	@echo ""
	@echo "Build:"
	@echo "  make build       Build all images"
	@echo "  make build-be    Build backend only"
	@echo "  make build-fe    Build frontend only"
	@echo ""
	@echo "Cleanup:"
	@echo "  make clean       Clean Docker resources"
	@echo "  make clean-all   Deep clean (removes volumes)"
	@echo ""
	@echo "Testing:"
	@echo "  make test        Run all tests"
	@echo "  make test-be     Run backend tests"
	@echo "  make test-fe     Run frontend tests"

# Development commands
dev-up:
	./docker.sh dev:up

dev-down:
	./docker.sh dev:down

dev-restart:
	./docker.sh dev:restart

dev-logs:
	./docker.sh dev:logs

# Production commands
prod-up:
	./docker.sh prod:up

prod-down:
	./docker.sh prod:down

prod-restart:
	./docker.sh prod:restart

# Database commands
db-migrate:
	./docker.sh db:migrate

db-seed:
	./docker.sh db:seed

db-reset:
	./docker.sh db:reset

db-backup:
	./docker.sh db:backup

# Build commands
build:
	./docker.sh build:all

build-be:
	./docker.sh build:backend

build-fe:
	./docker.sh build:frontend

# Cleanup commands
clean:
	./docker.sh clean:containers
	./docker.sh clean:images

clean-all:
	./docker.sh clean:all

# Test commands
test:
	docker-compose exec backend npm test
	docker-compose exec frontend npm test

test-be:
	docker-compose exec backend npm test

test-fe:
	docker-compose exec frontend npm test

# Status and monitoring
status:
	./docker.sh status

health:
	./docker.sh health

# Install dependencies
install:
	npm run install:all

# Setup new environment
setup: install build dev-up db-migrate
	@echo "✅ Environment setup complete!"
	@echo "Frontend: http://localhost:5173"
	@echo "Backend: http://localhost:3000"
