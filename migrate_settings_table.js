/**
 * Create Settings Table Migration Script
 * 
 * This script creates the settings table in the database if it doesn't exist.
 */

import { db } from './server/db.ts';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('Starting settings table migration...');
  
  try {
    // Check if settings table exists
    const tableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_name = 'settings'
      );
    `);
    
    const exists = tableExists[0]?.exists;
    
    if (exists) {
      console.log('Settings table already exists');
    } else {
      console.log('Creating settings table...');
      
      // Create the settings table
      await db.execute(sql`
        CREATE TABLE "settings" (
          "id" SERIAL PRIMARY KEY,
          "key" TEXT NOT NULL UNIQUE,
          "value" TEXT,
          "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
        );
      `);
      
      console.log('Settings table created successfully');
      
      // Create initial global_prompt setting
      await db.execute(sql`
        INSERT INTO "settings" ("key", "value") 
        VALUES ('global_prompt', '')
        ON CONFLICT ("key") DO UPDATE
        SET "value" = EXCLUDED."value";
      `);
      
      console.log('Initial global_prompt setting created');
    }
    
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

main();