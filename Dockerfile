# =============================================================================
# Tazama Case Management System - Multi-stage Docker Build
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Backend Build
# -----------------------------------------------------------------------------
FROM node:22-alpine AS backend-builder

WORKDIR /app/backend

# Copy package files and install all dependencies (including dev) for the build
COPY backend/package*.json ./
RUN npm ci

# Copy the rest of the backend source code
COPY backend/ .

# Generate Prisma client
RUN npx prisma generate

# Build the backend
RUN npm run build

# ----------------------------------------------------------------------------- 
# Stage 2: Frontend Build
# -----------------------------------------------------------------------------
FROM node:22-alpine AS frontend-builder

WORKDIR /app/frontend

# Install Alpine build dependencies needed for TypeScript and some npm modules
RUN apk add --no-cache python3 g++ make bash

# Copy package files and install all dependencies (including dev)
COPY frontend/package*.json ./

# Install dev dependencies including @types/node
RUN npm ci

# Copy the rest of the frontend source code
COPY frontend/ .

# Build the frontend (Vite + TypeScript)
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 3: Production Backend Runtime
# -----------------------------------------------------------------------------
FROM node:22-alpine AS backend-production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nestjs -u 1001

WORKDIR /app

# Copy package.json and install production dependencies
COPY backend/package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy built application and prisma client
COPY --from=backend-builder --chown=nestjs:nodejs /app/backend/dist ./dist
COPY --from=backend-builder --chown=nestjs:nodejs /app/backend/node_modules/.prisma ./node_modules/.prisma
COPY --from=backend-builder --chown=nestjs:nodejs /app/backend/prisma ./prisma

# Copy public key if it exists
COPY --from=backend-builder /app/backend/public-key.pem ./public-key.pem 2>/dev/null || true

# Set ownership
RUN chown -R nestjs:nodejs /app
USER nestjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

# Start the application
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/src/main.js"]

# -----------------------------------------------------------------------------
# Stage 4: Production Frontend Runtime (Nginx)
# -----------------------------------------------------------------------------
FROM nginx:alpine AS frontend-production

# Copy built frontend assets
COPY --from=frontend-builder /app/frontend/dist /usr/share/nginx/html

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Create nginx user
RUN addgroup -g 1001 -S nginx && adduser -S nginx -u 1001 -G nginx

# Set ownership
RUN chown -R nginx:nginx /usr/share/nginx/html
RUN chown -R nginx:nginx /var/cache/nginx
RUN chown -R nginx:nginx /var/log/nginx
RUN chown -R nginx:nginx /etc/nginx/conf.d
RUN touch /var/run/nginx.pid
RUN chown -R nginx:nginx /var/run/nginx.pid

# Switch to nginx user
USER nginx

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost/ || exit 1

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]