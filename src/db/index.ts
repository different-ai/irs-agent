import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from './schema';

// Create PGlite instance with persistence
const client = new PGlite('idb://agent-view-db');

// Create Drizzle instance
export const db = drizzle(client, { schema });

// Export the client for direct access if needed
export { client as pgClient };

// Initialize database
export async function initDB() {
  try {
    // Wait for client to be ready
    while (!client.ready) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Execute migration SQL
    await client.exec(`
      -- Drop existing tables if they exist
      DROP TABLE IF EXISTS classified_items;
      DROP TABLE IF EXISTS agent_steps;
      DROP TABLE IF EXISTS support_docs;
      DROP TABLE IF EXISTS financial_activities;

      -- Create classified_items table
      CREATE TABLE classified_items (
        id SERIAL PRIMARY KEY,
        text TEXT NOT NULL,
        app_name TEXT,
        window_name TEXT,
        timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
        type TEXT NOT NULL,
        image TEXT,
        classification JSONB NOT NULL,
        is_important BOOLEAN NOT NULL,
        confidence TEXT NOT NULL,
        embedding TEXT, -- Store embedding as JSON string array
        hyper_info TEXT -- Store the hyper-specific info string
      );

      -- Create btree index on id for faster lookups
      CREATE INDEX classified_items_id_idx ON classified_items (id);

      -- Create index on hyper_info for faster duplicate checking
      CREATE INDEX classified_items_hyper_info_idx ON classified_items (hyper_info);

      -- Create agent_steps table
      CREATE TABLE agent_steps (
        id SERIAL PRIMARY KEY,
        classification_id TEXT NOT NULL,
        timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
        human_action JSONB,
        human_result TEXT,
        text TEXT,
        tool_calls JSONB,
        tool_results JSONB,
        usage JSONB,
        finish_reason TEXT
      );

      -- Create support_docs table
      CREATE TABLE support_docs (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMP NOT NULL,
        summary TEXT NOT NULL,
        key_points JSONB NOT NULL,
        recommended_actions JSONB NOT NULL,
        timeframe JSONB NOT NULL,
        raw_data JSONB
      );

      -- Create financial_activities table
      CREATE TABLE financial_activities (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMP NOT NULL,
        type TEXT NOT NULL,
        amount NUMERIC NOT NULL,
        currency TEXT NOT NULL,
        description TEXT NOT NULL,
        sender_name TEXT,
        receiver_name TEXT,
        confidence NUMERIC NOT NULL,
        source_text TEXT NOT NULL,
        source_type TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        metadata JSONB
      );
    `);
    
    console.log('Database initialized successfully with embedding support');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
} 