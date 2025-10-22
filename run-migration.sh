#!/bin/bash

# Run the cascade delete migration
# Usage: ./run-migration.sh

echo "Running cascade delete migration..."

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Run the migration
psql $DATABASE_URL -f migrations/add_cascade_delete_to_teams.sql

echo "Migration complete!"
