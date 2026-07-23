#!/bin/sh

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

echo "Seeding reference_ids..."
psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "tazama_cms" <<'SQL'
INSERT INTO "reference_ids" ("txTp", "referenceIdName")
VALUES
  ('pacs.008.001.10', 'EndToEndId'),
  ('pacs.002.001.12', 'OrgnlEndToEndId')
ON CONFLICT ("txTp")
DO UPDATE SET "referenceIdName" = EXCLUDED."referenceIdName";
SQL

echo "Migrations complete."