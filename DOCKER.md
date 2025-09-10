# 🐳 Docker Setup for Tazama Case Management System

This document provides comprehensive instructions for containerizing and deploying the Tazama Case Management System using Docker and Docker Compose.

## 📋 Prerequisites

- Docker Engine 20.10 or later
- Docker Compose 2.0 or later
- At least 4GB RAM available for containers
- At least 10GB disk space

## 🚀 Quick Start

### Development Environment

```bash
# Option 1: Using the management script
./docker.sh dev:up

# Option 2: Using Make
make dev-up

# Option 3: Using Docker Compose directly
docker-compose up -d
```

### Production Environment

```bash
# Configure production environment variables
cp .env.production .env
# Edit .env with your production values

# Start production environment
./docker.sh prod:up
# OR
make prod-up
```

## 📁 File Structure

```
.
├── Dockerfile                    # Multi-stage production build
├── docker-compose.yml           # Development environment
├── docker-compose.prod.yml      # Production environment
├── nginx.conf                   # Nginx configuration for frontend
├── docker.sh                    # Management script
├── Makefile                     # Make commands
├── .env.development             # Development environment variables
├── .env.production              # Production environment variables
├── .dockerignore               # Docker ignore rules
├── healthcheck.js              # Health check script
├── backend/
│   ├── Dockerfile              # Backend development Dockerfile
│   └── prisma/
│       └── init.sql            # Database initialization
└── frontend/
    └── Dockerfile              # Frontend development Dockerfile
```

## 🛠️ Available Services

### Development Services

| Service | Port | Description |
|---------|------|-------------|
| Frontend | 5173 | React development server |
| Backend | 3000 | NestJS API server |
| Database | 5432 | PostgreSQL database |
| Redis | 6379 | Redis cache |
| NATS | 4222, 8222 | Message broker |

### Production Services

| Service | Port | Description |
|---------|------|-------------|
| Frontend | 80, 443 | Nginx web server |
| Backend | Internal | NestJS API (load balanced) |
| Load Balancer | 8080, 9000 | HAProxy load balancer |
| Database | Internal | PostgreSQL database |
| Redis | Internal | Redis cache |
| NATS | Internal | Message broker |

## 📝 Management Commands

### Using the Docker Script

```bash
# Development
./docker.sh dev:up          # Start development environment
./docker.sh dev:down        # Stop development environment
./docker.sh dev:restart     # Restart development environment
./docker.sh dev:logs        # Show all logs
./docker.sh dev:logs backend # Show backend logs only

# Production
./docker.sh prod:up         # Start production environment
./docker.sh prod:down       # Stop production environment
./docker.sh prod:restart    # Restart production environment

# Database
./docker.sh db:migrate      # Run migrations
./docker.sh db:seed         # Seed database
./docker.sh db:reset        # Reset database (⚠️  destroys data)
./docker.sh db:backup       # Create backup

# Build
./docker.sh build:all       # Build all images
./docker.sh build:backend   # Build backend only
./docker.sh build:frontend  # Build frontend only

# Cleanup
./docker.sh clean:containers # Remove stopped containers
./docker.sh clean:images    # Remove unused images
./docker.sh clean:volumes   # Remove volumes (⚠️  destroys data)
./docker.sh clean:all       # Full cleanup

# Monitoring
./docker.sh status          # Show container status
./docker.sh health          # Health check all services
```

### Using Make Commands

```bash
# Development
make dev-up                 # Start development
make dev-down               # Stop development
make dev-restart            # Restart development

# Production
make prod-up                # Start production
make prod-down              # Stop production

# Database
make db-migrate             # Run migrations
make db-seed                # Seed database
make db-backup              # Backup database

# Build & Clean
make build                  # Build all images
make clean                  # Clean resources
make test                   # Run tests

# Setup new environment
make setup                  # Full setup (install + build + start + migrate)
```

## ⚙️ Configuration

### Environment Variables

#### Development (.env.development)
```bash
DB_NAME=tazama_cms
DB_USER=tazama_user
DB_PASSWORD=tazama_dev_password_123
JWT_SECRET=your-super-secret-jwt-key-for-development-only
VITE_API_BASE_URL=http://localhost:3000
```

#### Production (.env.production)
```bash
DB_NAME=tazama_cms
DB_USER=tazama_user
DB_PASSWORD=CHANGE_THIS_IN_PRODUCTION
JWT_SECRET=CHANGE_THIS_TO_A_STRONG_SECRET_IN_PRODUCTION
FRONTEND_URL=https://your-domain.com
```

### Database Configuration

The system uses PostgreSQL with automatic initialization:
- Automatic extension installation (uuid-ossp, pg_trgm)
- Performance indexes creation
- User permissions setup
- Health check function

### Frontend Configuration

Nginx serves the React application with:
- SPA routing support
- Static asset caching
- Security headers
- API proxy to backend
- Gzip compression

## 🔍 Health Monitoring

### Health Check Endpoints

- Frontend: `http://localhost:5173/health`
- Backend: `http://localhost:3000/health`
- Database: Built-in PostgreSQL health check
- Redis: Built-in Redis health check

### Monitoring Commands

```bash
# Check all service health
./docker.sh health

# View container status
./docker.sh status

# View logs
./docker.sh dev:logs [service]
```

## 🔧 Troubleshooting

### Common Issues

#### Port Conflicts
```bash
# Check what's using ports
lsof -i :5173  # Frontend
lsof -i :3000  # Backend
lsof -i :5432  # Database

# Stop conflicting services or change ports in docker-compose.yml
```

#### Database Connection Issues
```bash
# Check database status
docker-compose exec database pg_isready -U tazama_user -d tazama_cms

# Reset database connection
./docker.sh dev:restart
```

#### Build Issues
```bash
# Clean build cache
docker builder prune

# Rebuild everything
./docker.sh build:all
```

#### Permission Issues
```bash
# Fix Docker script permissions
chmod +x docker.sh

# Fix file ownership (if needed)
sudo chown -R $USER:$USER .
```

### Debugging

#### Container Logs
```bash
# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f database
```

#### Container Shell Access
```bash
# Access backend container
docker-compose exec backend sh

# Access database container
docker-compose exec database psql -U tazama_user -d tazama_cms

# Access frontend container
docker-compose exec frontend sh
```

#### Database Debugging
```bash
# Connect to database
docker-compose exec database psql -U tazama_user -d tazama_cms

# Check database tables
docker-compose exec database psql -U tazama_user -d tazama_cms -c "\dt"

# Run custom query
docker-compose exec database psql -U tazama_user -d tazama_cms -c "SELECT * FROM health_check();"
```

## 🚀 Production Deployment

### Pre-deployment Checklist

1. **Update Environment Variables**
   ```bash
   cp .env.production .env
   # Edit .env with production values
   ```

2. **Security Configuration**
   - Change all default passwords
   - Update JWT secrets
   - Configure SSL certificates
   - Set appropriate CORS origins

3. **SSL Setup** (if using HTTPS)
   ```bash
   mkdir ssl
   # Copy your SSL certificates to ssl/
   # Update nginx.conf with SSL configuration
   ```

4. **Database Backup Strategy**
   ```bash
   # Setup automated backups
   crontab -e
   # Add: 0 2 * * * /path/to/project/docker.sh db:backup
   ```

### Production Commands

```bash
# Deploy to production
./docker.sh prod:up

# Check production health
./docker.sh health

# View production logs
docker-compose -f docker-compose.prod.yml logs -f

# Scale backend (if needed)
docker-compose -f docker-compose.prod.yml up -d --scale backend=3
```

## 📊 Performance Optimization

### Development Performance
- Use volume mounts for live code reloading
- Enable caching for npm modules
- Use multi-stage builds to reduce image size

### Production Performance
- Enable Nginx gzip compression
- Use Redis for session storage
- Scale backend horizontally with load balancer
- Use PostgreSQL connection pooling

## 🔐 Security

### Container Security
- Run containers as non-root users
- Use Alpine Linux base images
- Regular security updates
- Limit container resources

### Network Security
- Internal networks for service communication
- Expose only necessary ports
- Use environment variables for secrets
- Enable HTTPS in production

## 📚 Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [NestJS Docker Guide](https://docs.nestjs.com/recipes/dockerfile)
- [React Production Build](https://create-react-app.dev/docs/deployment/)

## 🆘 Support

For issues related to containerization:
1. Check the troubleshooting section above
2. Review container logs: `./docker.sh dev:logs`
3. Check service health: `./docker.sh health`
4. Create an issue in the project repository
