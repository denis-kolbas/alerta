#!/bin/bash

# Run the organizations migration
# Usage: ./run-org-migration.sh

echo "Running organizations migration..."

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Run the migration
psql $DATABASE_URL -f migrations/add_organizations.sql

echo "Migration complete!"
echo ""
echo "Summary:"
echo "- Created organizations table"
echo "- Created organization_members table"
echo "- Migrated existing teams to organizations"
echo "- Updated team_members roles (owner → admin)"
echo "- Moved subscription fields to organizations"
