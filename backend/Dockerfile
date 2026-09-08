# syntax=docker/dockerfile:1
# SPDX-License-Identifier: Apache-2.0
ARG BUILD_IMAGE=node:24-trixie
ARG RUN_IMAGE=gcr.io/distroless/nodejs24-debian13:nonroot

# Builder stage: Build the application
FROM ${BUILD_IMAGE} AS builder
LABEL stage=build

WORKDIR /home/app

COPY ./src ./src
COPY ./prisma ./prisma
COPY ./package*.json ./
COPY ./tsconfig.json ./
COPY .npmrc ./
COPY ./migrate.sh ./migrate.sh

# Ensure shell script is Linux-compatible even when checked out with CRLF on Windows.
RUN sed -i 's/\r$//' /home/app/migrate.sh && chmod +x /home/app/migrate.sh

RUN --mount=type=secret,id=GH_TOKEN,env=GH_TOKEN npm ci --ignore-scripts

RUN npx prisma generate

RUN npm run build

RUN mkdir -p dist/src/modules/bpmn && \
    cp src/modules/bpmn/*.xml dist/src/modules/bpmn/

FROM ${BUILD_IMAGE} AS migrate

WORKDIR /home/app

# Copy everything from builder
COPY --from=builder /home/app ./

# Install tools needed for DB setup
RUN apt-get update && apt-get install -y --no-install-recommends \
    postgresql-client netcat-openbsd && \
    rm -rf /var/lib/apt/lists/*

CMD ["sh"]

# Runtime stage: Set up runtime environment
FROM ${RUN_IMAGE} AS run-env

USER nonroot

WORKDIR /home/app

COPY --from=builder /home/app/node_modules ./node_modules
COPY --from=builder /home/app/dist ./dist
COPY --from=builder /home/app/package.json ./package.json

EXPOSE 3090

CMD ["dist/src/main.js"]