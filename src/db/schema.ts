import { pgTable, serial, text, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core';

// Table for classified items
export const classifiedItems = pgTable('classified_items', {
  id: serial('id').primaryKey(),
  text: text('text').notNull(),
  appName: text('app_name'),
  windowName: text('window_name'),
  timestamp: timestamp('timestamp').notNull(),
  type: text('type').notNull(),
  image: text('image'),
  classification: jsonb('classification').notNull(),
  isImportant: boolean('is_important').notNull(),
  confidence: text('confidence').notNull(),
  embedding: text('embedding'), // Store as JSON string array
  hyperInfo: text('hyper_info'), // Store the hyper-specific info string
});

// Table for agent steps
export const agentSteps = pgTable('agent_steps', {
  id: serial('id').primaryKey(),
  classificationId: text('classification_id').notNull(),
  timestamp: timestamp('timestamp').notNull(),
  humanAction: jsonb('human_action'),
  humanResult: text('human_result'),
  text: text('text'),
  toolCalls: jsonb('tool_calls'),
  toolResults: jsonb('tool_results'),
  usage: jsonb('usage'),
  finishReason: text('finish_reason'),
});

// Table for support documentation
export const supportDocs = pgTable('support_docs', {
  id: serial('id').primaryKey(),
  timestamp: timestamp('timestamp').notNull(),
  summary: text('summary').notNull(),
  keyPoints: jsonb('key_points').notNull(),
  recommendedActions: jsonb('recommended_actions').notNull(),
  timeframe: jsonb('timeframe').notNull(), // Store start and end time
  rawData: jsonb('raw_data'), // Store the original data used to generate the doc
}); 