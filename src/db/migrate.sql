-- Enable the vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Drop existing tables if they exist
DROP TABLE IF EXISTS classified_items;
DROP TABLE IF EXISTS agent_steps;
DROP TABLE IF EXISTS support_docs;

-- Create classified_items table with vector support
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
  embedding vector(1536)
);

-- Create HNSW index for vector similarity search
CREATE INDEX ON classified_items 
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

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
CREATE TABLE IF NOT EXISTS support_docs (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMP NOT NULL,
  summary TEXT NOT NULL,
  key_points JSONB NOT NULL,
  recommended_actions JSONB NOT NULL,
  timeframe JSONB NOT NULL,
  raw_data JSONB
); 