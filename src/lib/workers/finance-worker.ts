"use client";

import { generateObject } from 'ai';
import { z } from 'zod';
import { BaseWorker, WorkerContext } from './base-worker';

// Schema for financial activity detection
export const financeInputSchema = z.object({
  text: z.string(),
  timestamp: z.string(),
  source: z.string(),
}).required();

// Schema for parsed financial information
export const financeOutputSchema = z.object({
  type: z.enum(['invoice', 'payment', 'receipt', 'subscription']),
  amount: z.number(),
  currency: z.string(),
  description: z.string(),
  parties: z.array(z.object({
    name: z.string(),
    role: z.enum(['sender', 'receiver']),
  })),
  confidence: z.number(),
}).required();

export type FinanceInput = z.infer<typeof financeInputSchema>;
export type FinanceOutput = z.infer<typeof financeOutputSchema>;

export class FinanceWorker extends BaseWorker<FinanceInput, FinanceOutput> {
  private readonly FINANCE_KEYWORDS = ['invoice', 'payment', 'receipt', 'subscription'];

  private containsFinanceKeyword(text: string): boolean {
    return this.FINANCE_KEYWORDS.some(keyword => 
      text.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  async execute(input: FinanceInput, context: WorkerContext) {
    this.initializeApi(context.apiKey);

    // Skip if no finance keywords found
    if (!this.containsFinanceKeyword(input.text)) {
      return null;
    }

    const { object: resolution } = await generateObject({
      model: this.openai('o3-mini'),
      schema: financeOutputSchema,
      prompt: `Extract financial information from this text:
      "${input.text}"
      
      Source: ${input.source}
      Timestamp: ${input.timestamp}

      Focus on:
      1. Type of transaction (invoice/payment/receipt/subscription)
      2. Amount and currency
      3. Description of the transaction
      4. Parties involved (sender/receiver)
      
      Return structured data with confidence score.`,
    });

    return resolution;
  }
}

export const financeWorker = new FinanceWorker(); 