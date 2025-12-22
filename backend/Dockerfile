FROM node:22-alpine

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY .npmrc ./

# Install dependencies
RUN npm i
# Copy source code
COPY . .

RUN npx prisma generate
RUN npx prisma generate --schema=prismaDWH/schema.dwh.prisma
# Build the application
RUN npm run build
# Expose port
EXPOSE 3000

# Start the application in development mode
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "run", "start:dev"]