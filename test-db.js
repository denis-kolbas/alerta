// Simple database connection test
const postgres = require('postgres');
require('dotenv').config();

const sql = postgres(process.env.POSTGRES_URL);

async function test() {
  try {
    console.log('Testing database connection...');
    const result = await sql`SELECT NOW() as time, version()`;
    console.log('✓ Connection successful!');
    console.log('Time:', result[0].time);
    console.log('Version:', result[0].version.substring(0, 50) + '...');
    
    console.log('\nTesting users table...');
    const users = await sql`SELECT COUNT(*) as count FROM users`;
    console.log('✓ Users table accessible, count:', users[0].count);
    
    await sql.end();
    process.exit(0);
  } catch (error) {
    console.error('✗ Error:', error.message);
    process.exit(1);
  }
}

test();
