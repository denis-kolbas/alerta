const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env' });

async function runMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('🔄 Running organizations migration...\n');

    const sql = fs.readFileSync(
      path.join(__dirname, 'migrations/add_organizations.sql'),
      'utf8'
    );

    await pool.query(sql);

    console.log('✅ Migration complete!\n');
    console.log('Summary:');
    console.log('- Created organizations table');
    console.log('- Created organization_members table');
    console.log('- Migrated existing teams to organizations');
    console.log('- Updated team_members roles (owner → admin)');
    console.log('- Moved subscription fields to organizations\n');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
