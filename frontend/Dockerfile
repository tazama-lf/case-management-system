# =============================================================================
# Frontend Development Dockerfile
# =============================================================================

FROM node:22-alpine

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Set environment variables directly in Dockerfile
ENV VITE_API_BASE_URL=http://10.10.80.30:3000
ENV VITE_APP_NAME="Tazama Case Management System"
ENV VITE_APP_VERSION=0.0.1

# Expose port
EXPOSE 5173

# Start the development server
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]