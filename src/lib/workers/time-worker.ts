"use client";

import { generateObject } from 'ai';
import { z } from 'zod';
import { BaseWorker, WorkerContext } from './base-worker';

export const timeInputSchema = z.object({
  timeExpression: z.string(),
  referenceTime: z.string(),
}).required();

export const timeOutputSchema = z.object({
  timeframe: z.object({
    type: z.enum(['specific', 'relative', 'none']),
    startTime: z.string(),
    endTime: z.string(),
    confidence: z.number(),
    explanation: z.string(),
  }).required(),
}).required();

export type TimeInput = z.infer<typeof timeInputSchema>;
export type TimeOutput = z.infer<typeof timeOutputSchema>;

export class TimeWorker extends BaseWorker<TimeInput, TimeOutput> {
  async execute(input: TimeInput, context: WorkerContext) {
    this.initializeApi(context.apiKey);

    const { object: resolution } = await generateObject({
      model: this.openai('o3-mini'),
      schema: timeOutputSchema,
      prompt: `Parse this time expression: "${input.timeExpression}"
      Reference time: ${input.referenceTime}

      Convert to specific start and end times.
      Consider:
      1. Relative expressions ("yesterday", "last week")
      2. Specific dates
      3. Time ranges ("between X and Y")
      
      Return structured timeframe data with confidence.`,
    });

    return resolution;
  }
}

export const timeWorker = new TimeWorker(); 