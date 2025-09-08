#!/bin/bash

# =============================================================================
# Docker Management Scripts for Tazama Case Management System
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker first."
        exit 1
    fi
}

# Development environment
dev_up() {
    print_info "Starting development environment..."
    check_docker
    cp .env.development .env
    docker-compose up -d
    print_success "Development environment started!"
    print_info "Frontend: http://localhost:5173"
    print_info "Backend: http://localhost:3000"
    print_info "Database: localhost:5432"
}

dev_down() {
    print_info "Stopping development environment..."
    docker-compose down
    print_success "Development environment stopped!"
}

dev_restart() {
    print_info "Restarting development environment..."
    dev_down
    dev_up
}

dev_logs() {
    docker-compose logs -f "${1:-}"
}

# Production environment
prod_up() {
    print_info "Starting production environment..."
    check_docker
    cp .env.production .env
    docker-compose -f docker-compose.prod.yml up -d
    print_success "Production environment started!"
}

prod_down() {
    print_info "Stopping production environment..."
    docker-compose -f docker-compose.prod.yml down
    print_success "Production environment stopped!"
}

prod_restart() {
    print_info "Restarting production environment..."
    prod_down
    prod_up
}

# Database operations
db_migrate() {
    print_info "Running database migrations..."
    docker-compose exec backend npm run prisma:migrate
    print_success "Database migrations completed!"
}

db_seed() {
    print_info "Seeding database..."
    docker-compose exec backend npm run prisma:seed
    print_success "Database seeded!"
}

db_reset() {
    print_warning "This will reset the database and lose all data!"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_info "Resetting database..."
        docker-compose exec backend npm run prisma:reset
        print_success "Database reset completed!"
    else
        print_info "Database reset cancelled."
    fi
}

db_backup() {
    print_info "Creating database backup..."
    BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"
    docker-compose exec database pg_dump -U tazama_user tazama_cms > "backups/$BACKUP_FILE"
    print_success "Database backup created: backups/$BACKUP_FILE"
}

# Build operations
build_all() {
    print_info "Building all Docker images..."
    docker-compose build
    print_success "All images built successfully!"
}

build_backend() {
    print_info "Building backend image..."
    docker-compose build backend
    print_success "Backend image built successfully!"
}

build_frontend() {
    print_info "Building frontend image..."
    docker-compose build frontend
    print_success "Frontend image built successfully!"
}

# Clean up operations
clean_containers() {
    print_info "Removing stopped containers..."
    docker container prune -f
    print_success "Stopped containers removed!"
}

clean_images() {
    print_info "Removing unused images..."
    docker image prune -f
    print_success "Unused images removed!"
}

clean_volumes() {
    print_warning "This will remove all Docker volumes and data!"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_info "Removing Docker volumes..."
        docker volume prune -f
        print_success "Docker volumes removed!"
    else
        print_info "Volume cleanup cancelled."
    fi
}

clean_all() {
    clean_containers
    clean_images
    clean_volumes
}

# Status and monitoring
status() {
    print_info "Container status:"
    docker-compose ps
}

health() {
    print_info "Health check status:"
    echo "Frontend: $(curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/ || echo "DOWN")"
    echo "Backend: $(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health || echo "DOWN")"
    echo "Database: $(docker-compose exec database pg_isready -U tazama_user -d tazama_cms > /dev/null 2>&1 && echo "UP" || echo "DOWN")"
}

# Help function
show_help() {
    cat << EOF
Tazama Case Management System - Docker Management Script

USAGE:
    $0 [COMMAND]

DEVELOPMENT COMMANDS:
    dev:up          Start development environment
    dev:down        Stop development environment  
    dev:restart     Restart development environment
    dev:logs [service]  Show logs (optionally for specific service)

PRODUCTION COMMANDS:
    prod:up         Start production environment
    prod:down       Stop production environment
    prod:restart    Restart production environment

DATABASE COMMANDS:
    db:migrate      Run database migrations
    db:seed         Seed database with initial data
    db:reset        Reset database (WARNING: destroys data)
    db:backup       Create database backup

BUILD COMMANDS:
    build:all       Build all Docker images
    build:backend   Build backend image only
    build:frontend  Build frontend image only

CLEANUP COMMANDS:
    clean:containers Remove stopped containers
    clean:images    Remove unused images  
    clean:volumes   Remove all volumes (WARNING: destroys data)
    clean:all       Run all cleanup commands

MONITORING COMMANDS:
    status          Show container status
    health          Show health check status
    
    help            Show this help message

EXAMPLES:
    $0 dev:up              # Start development environment
    $0 dev:logs backend    # Show backend logs
    $0 db:migrate          # Run migrations
    $0 build:all           # Build all images
    $0 clean:containers    # Clean up containers

EOF
}

# Main command dispatcher
case "${1:-help}" in
    "dev:up")       dev_up ;;
    "dev:down")     dev_down ;;
    "dev:restart")  dev_restart ;;
    "dev:logs")     dev_logs "$2" ;;
    "prod:up")      prod_up ;;
    "prod:down")    prod_down ;;
    "prod:restart") prod_restart ;;
    "db:migrate")   db_migrate ;;
    "db:seed")      db_seed ;;
    "db:reset")     db_reset ;;
    "db:backup")    db_backup ;;
    "build:all")    build_all ;;
    "build:backend") build_backend ;;
    "build:frontend") build_frontend ;;
    "clean:containers") clean_containers ;;
    "clean:images") clean_images ;;
    "clean:volumes") clean_volumes ;;
    "clean:all")    clean_all ;;
    "status")       status ;;
    "health")       health ;;
    "help"|*)       show_help ;;
esac
