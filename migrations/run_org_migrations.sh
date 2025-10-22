#!/bin/bash

# Migration script to update database for organization-level permissions
# Run this script to apply all organization-related migrations

set -e  # Exit on error

echo "🚀 Starting organization migrations..."
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL environment variable is not set"
  echo "Please set it with: export DATABASE_URL='your-database-url'"
  exit 1
fi

echo "📋 Migration order:"
echo "  1. add_organizations.sql - Create organizations and migrate teams"
echo "  2. update_invitations_to_org.sql - Update invitations to reference organizations"
echo "  3. remove_team_members_table.sql - Remove team_members table (no longer needed)"
echo ""

read -p "⚠️  This will modify your database. Continue? (y/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "❌ Migration cancelled"
  exit 1
fi

echo ""
echo "📦 Step 1: Creating organizations and migrating teams..."
psql "$DATABASE_URL" -f migrations/add_organizations.sql
echo "✅ Organizations created"

echo ""
echo "📦 Step 2: Updating invitations to reference organizations..."
psql "$DATABASE_URL" -f migrations/update_invitations_to_org.sql
echo "✅ Invitations updated"

echo ""
echo "📦 Step 3: Removing team_members table..."
psql "$DATABASE_URL" -f migrations/remove_team_members_table.sql
echo "✅ team_members table removed"

echo ""
echo "🎉 All migrations completed successfully!"
echo ""
echo "📊 Summary:"
echo "  - Organizations table created"
echo "  - Teams now belong to organizations"
echo "  - Organization members table created"
echo "  - Invitations now reference organizations"
echo "  - team_members table removed (no longer needed)"
echo "  - Users access workspaces via organization membership"
echo ""
echo "✨ New structure:"
echo "  User → organization_members → Organization → teams (workspaces)"
