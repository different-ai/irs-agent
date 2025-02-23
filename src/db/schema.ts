import { pgTable, serial, text, boolean, timestamp, jsonb, numeric } from 'drizzle-orm/pg-core';

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

// New table for financial activities
export const financialActivities = pgTable('financial_activities', {
  id: serial('id').primaryKey(),
  timestamp: timestamp('timestamp').notNull(),
  type: text('type').notNull(), // 'invoice', 'payment', 'receipt', 'subscription'
  amount: numeric('amount').notNull(),
  currency: text('currency').notNull(),
  description: text('description').notNull(),
  senderName: text('sender_name'),
  receiverName: text('receiver_name'),
  confidence: numeric('confidence').notNull(),
  sourceText: text('source_text').notNull(),
  sourceType: text('source_type').notNull(), // e.g., 'audio', 'ocr', etc.
  createdAt: timestamp('created_at').defaultNow(),
  metadata: jsonb('metadata'), // Optional field for additional data
}); 