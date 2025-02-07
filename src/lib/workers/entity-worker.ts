"use client";

import { generateObject } from 'ai';
import { z } from 'zod';
import { BaseWorker, WorkerContext } from './base-worker';

export const entityInputSchema = z.object({
  entities: z.array(z.object({
    name: z.string(),
    type: z.string(),
  }).required()),
}).required();

export const entityOutputSchema = z.object({
  resolvedEntities: z.array(z.object({
    original: z.string(),
    variants: z.array(z.string()),
    type: z.string(),
    confidence: z.number(),
  }).required()),
}).required();

export type EntityInput = z.infer<typeof entityInputSchema>;
export type EntityOutput = z.infer<typeof entityOutputSchema>;

export class EntityWorker extends BaseWorker<EntityInput, EntityOutput> {
  async execute(input: EntityInput, context: WorkerContext) {
    this.initializeApi(context.apiKey);

    const { object: resolution } = await generateObject({
      model: this.openai('o3-mini'),
      schema: entityOutputSchema,
      prompt: `Resolve these entities into their possible variants:
      ${input.entities.map(e => `- ${e.name} (${e.type})`).join('\n')}

      Consider:
      1. Common nicknames or abbreviations
      2. Different spellings
      3. Related terms
      
      Return structured data with confidence scores.`,
    });

    return resolution;
  }
}

export const entityWorker = new EntityWorker(); 