/**
 * Run database migration
 * Usage: npx tsx scripts/run-migration.ts migrations/fix_event_data_unique_constraint.sql
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const migrationFile = process.argv[2];
if (!migrationFile) {
  console.error('❌ Usage: npx tsx scripts/run-migration.ts <migration-file>');
  console.error('Example: npx tsx scripts/run-migration.ts migrations/fix_event_data_unique_constraint.sql');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('🔄 Running migration:', migrationFile);
  
  try {
    // Read the SQL file
    const sqlPath = join(process.cwd(), migrationFile);
    const sql = readFileSync(sqlPath, 'utf-8');
    
    console.log('\n📄 SQL to execute:');
    console.log('─'.repeat(60));
    console.log(sql);
    console.log('─'.repeat(60));
    
    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      // Try direct query if RPC doesn't exist
      console.log('\n⚠️  RPC method not available, trying direct query...');
      
      // Split by semicolon and execute each statement
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);
      
      for (const statement of statements) {
        console.log(`\n🔄 Executing: ${statement.substring(0, 50)}...`);
        const { error: queryError } = await supabase.rpc('exec', { query: statement });
        
        if (queryError) {
          console.error('❌ Error:', queryError.message);
          throw queryError;
        }
      }
    }
    
    console.log('\n✅ Migration completed successfully!');
    
  } catch (err: any) {
    console.error('\n❌ Migration failed:', err.message);
    console.error('\n💡 You may need to run this SQL manually in Supabase SQL Editor:');
    console.error('   1. Go to Supabase Dashboard → SQL Editor');
    console.error('   2. Paste the SQL from:', migrationFile);
    console.error('   3. Click "Run"');
    process.exit(1);
  }
}

runMigration();
