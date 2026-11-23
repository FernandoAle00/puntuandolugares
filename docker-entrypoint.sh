#!/bin/sh
set -e

mkdir -p /app/data/uploads

# Sync Drizzle schema and ensure initial seed (idempotent)
npx drizzle-kit push --force
npm run db:seed

exec npx next start -H 0.0.0.0 -p "${PORT:-3000}"
