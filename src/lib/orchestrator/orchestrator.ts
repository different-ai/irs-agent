"use client";

import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import { entityWorker, type EntityInput } from '../workers/entity-worker';
import { timeWorker, type TimeInput } from '../workers/time-worker';
import { searchWorker } from '../workers/search-worker';

// Query Analysis Schema
const queryAnalysisSchema = z.object({
  entities: z.array(z.object({
    name: z.string(),
    type: z.string(),
    synonyms: z.array(z.string()),
  }).required()),
  timeframe: z.object({
    type: z.enum(['specific', 'relative', 'none']),
    startTime: z.string(),
    endTime: z.string(),
    explanation: z.string(),
  }).required(),
  intent: z.object({
    type: z.enum([
      'last_occurrence',
      'most_frequent',
      'summarize',
      'pick_up',
      'how_to'
    ]),
    description: z.string(),
  }).required(),
  requiredWorkers: z.array(z.enum([
    'search',
    'entity',
    'time',
    'rank',
    'summarize'
  ])).required(),
  rationale: z.string(),
}).required();

export class QueryOrchestrator {
  private openai!: ReturnType<typeof createOpenAI>;

  constructor() {
    this.openai = createOpenAI({ apiKey: '' });
  }

  async analyze(query: string, apiKey: string) {
    this.initializeApi(apiKey);

    const { object: analysis } = await generateObject({
      model: this.openai('o3-mini'),
      schema: queryAnalysisSchema,
      prompt: `Analyze this user query: "${query}"

      Extract:
      1. Entities (names, objects, concepts)
      2. Timeframe (specific dates or relative times)
      3. User's intent (what type of answer they want)
      4. Which workers are needed
      5. Rationale for these choices

      Return a structured analysis that helps us:
      - Know what to search for
      - When to search
      - How to process results
      - Why we made these choices`,
    });

    return analysis;
  }

  private async executePipeline(analysis: z.infer<typeof queryAnalysisSchema>, apiKey: string) {
    const context = {
      apiKey,
      classificationId: crypto.randomUUID(),
      query: '',
      timeframe: analysis.timeframe,
    };

    const results = {
      entities: [],
      timeframe: null,
      searchResults: [],
      summary: '',
    };

    // Execute entity resolution if needed
    if (analysis.requiredWorkers.includes('entity')) {
      const entityResult = await entityWorker.execute({
        entities: analysis.entities,
      } as EntityInput, context);
      results.entities = entityResult.resolvedEntities;
    }

    // Execute time resolution if needed
    if (analysis.requiredWorkers.includes('time')) {
      const timeResult = await timeWorker.execute({
        timeExpression: analysis.timeframe.explanation,
        referenceTime: new Date().toISOString(),
      } as TimeInput, context);
      results.timeframe = timeResult.timeframe;
    }

    // Execute search with resolved entities and timeframe
    const searchResult = await searchWorker.execute({
      entities: results.entities,
      timeframe: results.timeframe || analysis.timeframe,
      intent: analysis.intent,
    }, context);

    return {
      ...results,
      searchResults: searchResult,
    };
  }

  async orchestrate(query: string, apiKey: string) {
    const analysis = await this.analyze(query, apiKey);
    const results = await this.executePipeline(analysis, apiKey);

    return {
      analysis,
      results,
      summary: results.summary,
    };
  }
}

export const queryOrchestrator = new QueryOrchestrator(); 