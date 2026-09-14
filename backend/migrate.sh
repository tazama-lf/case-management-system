#!/bin/sh
set -e

echo "Waiting for postgres..."

until nc -z "$POSTGRES_HOST" "$POSTGRES_PORT"; do
  sleep 2
done

echo "Creating databases if not exist..."

export PGPASSWORD="$POSTGRES_PASSWORD"

psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -tc "SELECT 1 FROM pg_database WHERE datname='flowable'" | grep -q 1 || \
psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -c "CREATE DATABASE flowable"

psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -tc "SELECT 1 FROM pg_database WHERE datname='tazama_cms'" | grep -q 1 || \
psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -c "CREATE DATABASE tazama_cms"

echo "Running CMS migrations..."
npx prisma migrate deploy

echo "Seeding reference_ids for tenant TAZAMA..."
psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "tazama_cms" -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO "reference_ids" ("txTp", "referenceIdName", "tenant_id")
VALUES
  ('pacs.008.001.10', 'EndToEndId',       'TAZAMA'),
  ('pacs.002.001.12', 'OrgnlEndToEndId',  'TAZAMA')
ON CONFLICT ("txTp", "tenant_id")
DO UPDATE SET "referenceIdName" = EXCLUDED."referenceIdName";
SQL

echo "Migrations complete."