#!/bin/sh

echo "Waiting for postgres..."

until nc -z "$POSTGRES_HOST" "$POSTGRES_PORT"; do
  sleep 2
done

echo "Creating databases if not exist..."

export PGPASSWORD="$POSTGRES_PASSWORD"

psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -tc "SELECT 1 FROM pg_database WHERE datname='flowable'" | grep -q 1 || \
psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -c "CREATE DATABASE flowable"

psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -tc "SELECT 1 FROM pg_database WHERE datname='tazama_dwh'" | grep -q 1 || \
psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -c "CREATE DATABASE tazama_dwh"

psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -tc "SELECT 1 FROM pg_database WHERE datname='tazama_cms'" | grep -q 1 || \
psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -c "CREATE DATABASE tazama_cms"

echo "Running DWH migrations..."
npx prisma migrate deploy --schema=prismaDWH/schema.dwh.prisma

echo "Running CMS migrations..."
npx prisma migrate deploy

echo "Migrations complete."