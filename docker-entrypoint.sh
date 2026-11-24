#!/bin/sh
set -e

mkdir -p /app/data/uploads

# Apply additive schema migrations and ensure initial seed (idempotent)
npm run db:migrate
npm run db:seed

exec npx next start -H 0.0.0.0 -p "${PORT:-3000}"
