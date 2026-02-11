
# =============================================================================
# Backend Development Dockerfile
# =============================================================================

FROM node:22-alpine

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY .npmrc .npmrc ./

# Install dependencies
RUN npm install --ignore-scripts

# Copy source code
COPY . .

RUN npx prisma generate

# Build the application
RUN npm run build
# Expose port
EXPOSE 3000

# Start the application in development mode
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "run", "start:dev"]
