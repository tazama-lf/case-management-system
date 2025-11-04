
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

# Generate Prisma client
RUN npx prisma generate

# Build the application
RUN npm run build

# Set Environment Variables
ENV DATABASE_URL=postgresql://postgres:postgres@10.10.80.30:5432/tazama_cms
ENV TRIAGE_TYPE=MANUAL
ENV CONFIDENCE_THRESHOLD=95
ENV CLIENT_SYSTEM_INTERDICTION_ENABLED=true
ENV SYSTEM_UUID=a9a8ff94-c7e4-4e6c-b421-e6d5d75a76e1
ENV TAZAMA_AUTH_URL=http://10.10.80.30:3020/v1/auth/login
ENV AUTH_PUBLIC_KEY_PATH=/opt/certs/public.pem
ENV CERT_PATH_PUBLIC=/opt/certs/public.pem
ENV FLOWABLE_URL=http://10.10.80.30:8081/flowable-rest
ENV FLOWABLE_USERNAME=rest-admin
ENV FLOWABLE_PASSWORD=test
ENV SERVER_URL=nats://10.10.80.30:4222
ENV STARTUP_TYPE=nats
ENV NODE_ENV=dev
ENV FUNCTION_NAME=relay-service
ENV PRODUCER_STREAM=default
ENV CONSUMER_STREAM=cms
ENV MAX_CPU=1
ENV SIDECAR_HOST=10.10.80.17:5000
ENV PRIORITY_FIRST_HALF=0.33
ENV PRIORITY_SECOND_HALF=0.66
ENV PRIORITY_THIRD_HALF=1.0
ENV DEFAULT_SLA_HOURS=72
ENV ALERT_PRIORITY_CRON_SCHEDULE="0 * * * *"

# Expose port
EXPOSE 3000

# Start the application in development mode
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "run", "start:dev"]
