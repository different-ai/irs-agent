"use client";

import { createOpenAI } from '@ai-sdk/openai';
import { generateObject, generateText } from 'ai';
import { z } from 'zod';
import { useAgentStepsStore } from '@/stores/agent-steps-store';
import { pipe } from "@screenpipe/browser";
import type { ContentType, ScreenpipeContent } from '@screenpipe/browser';

// Search input schema with plan - removed defaults
export const searchInputSchema = z.object({
  searchPlan: z.object({
    timeframe: z.object({
      type: z.enum(['specific', 'relative', 'none']),
      startTime: z.string(),
      endTime: z.string(),
      rationale: z.string().optional(),
    }),
    contentTypes: z.array(z.enum(['ocr', 'audio', 'ui'])),
    searchQueries: z.array(z.object({
      query: z.string(),
      explanation: z.string().optional(),
      expectedResults: z.array(z.string()),
      confidence: z.number(),
    })),
    rationale: z.string().optional(),
  }),
  userQuery: z.string().optional(),
  apiKey: z.string(),
  classificationId: z.string(),
});

// Search result schema
export const searchResultSchema = z.object({
  items: z.array(z.object({
    type: z.string(),
    content: z.object({
      text: z.string(),
      timestamp: z.string(),
      frame_id: z.number().optional(),
      file_path: z.string().optional(),
      offset_index: z.number().optional(),
      app_name: z.string().optional(),
      window_name: z.string().optional(),
      tags: z.array(z.string()).optional(),
    }),
    humanReadableAction: z.string().optional(),
    relevanceReason: z.string().optional(),
  })),
  summary: z.string(),
  nextStepRecommendation: z.string(),
});

// Helper schemas and types
const filteredResultSchema = z.object({
  results: z.array(z.object({
    relevant: z.boolean(),
    reason: z.string().optional(),
  })),
});

type SearchTimeframe = {
  type: 'specific' | 'relative' | 'none';
  startTime: string;
  endTime: string;
  rationale?: string;
};

const screenpipeContentSchema = z.object({
  text: z.string(),
  timestamp: z.string(),
  frame_id: z.number().optional(),
  file_path: z.string().optional(),
  offset_index: z.number().optional(),
  app_name: z.string().optional(),
  window_name: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

function sanitizeSearchQuery(query: string): string {
  return query
    .replace(/[#"*^{}[\]()~?\\$]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Type for search results
interface SearchResult {
  type: ContentType;
  content: ScreenpipeContent;
  humanReadableAction?: string;
  relevanceReason?: string;
}

class SearchWorker {
  private addStep!: (classificationId: string, step: any) => void;
  private openai!: ReturnType<typeof createOpenAI>;

  constructor() {
    this.addStep = () => {};
    this.openai = createOpenAI({ apiKey: '' });
  }

  private async executeSearches(
    queries: Array<{ query: string }>,
    contentTypes: ContentType[],
    timeframe: SearchTimeframe,
    classificationId: string
  ): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    let queryCounter = 0;
    const totalQueries = queries.length * contentTypes.length;

    for (const searchQuery of queries) {
      for (const contentType of contentTypes) {
        queryCounter++;
        const sanitized = sanitizeSearchQuery(searchQuery.query);

        this.addStep(classificationId, {
          humanAction: 'Search Progress',
          text: `Query ${queryCounter}/${totalQueries}: "${sanitized}" in ${contentType}`,
          finishReason: 'complete',
        });

        try {
          const searchResults = await pipe.queryScreenpipe({
            q: sanitized,
            contentType,
            startTime: timeframe.startTime,
            endTime: timeframe.endTime,
            limit: 10,
            minLength: 10,
            includeFrames: false,
          });

          if (searchResults?.data) {
            const filtered = searchResults.data.filter(item => {
              const windowName = (item.content as any)?.window_name?.toLowerCase() || '';
              return !windowName.includes('hyprsqrl');
            });

            filtered.forEach(item => {
              results.push({
                type: contentType,
                content: screenpipeContentSchema.parse(item.content),
                humanReadableAction: `Found in ${contentType} content`,
              });
            });
          }
        } catch (err: unknown) {
          console.error('Search error:', err);
          this.addStep(classificationId, {
            humanAction: 'Search Error',
            text: `Error executing search: ${err instanceof Error ? err.message : String(err)}`,
            finishReason: 'error',
          });
        }
      }
    }

    return results;
  }

  private async filterResults(results: SearchResult[], userQuery: string, chunkSize = 8) {
    const relevantItems: SearchResult[] = [];
    
    for (let i = 0; i < results.length; i += chunkSize) {
      const chunk = results.slice(i, i + chunkSize);
      const chunkPrompt = chunk
        .map((item, idx) => `
          Item ${idx}:
          Timestamp: ${item.content.timestamp}
          Text: "${item.content.text.replace(/\n/g, ' ')}"
        `)
        .join('\n');

      const { object: decision } = await generateObject({
        model: 'o3-mini',
        schema: filteredResultSchema,
        prompt: `The user asked: "${userQuery}"
          We have ${chunk.length} items from OCR/audio/UI data.

          For each item, decide if it's truly relevant. Return:
          { "relevant": boolean, "reason": string } in the same order.

          Items:
          ${chunkPrompt}`,
      });

      decision.results.forEach((res, idx) => {
        if (res.relevant) {
          relevantItems.push({
            ...chunk[idx],
            relevanceReason: res.reason,
          });
        }
      });
    }

    return relevantItems;
  }

  async execute(input: z.infer<typeof searchInputSchema>) {
    this.openai = createOpenAI({ apiKey: input.apiKey });
    this.addStep = useAgentStepsStore.getState().addStep;

    const { classificationId, userQuery } = input;
    const { timeframe, contentTypes, searchQueries } = input.searchPlan;

    // Step 1: Execute searches
    const broadResults = await this.executeSearches(
      searchQueries,
      contentTypes as ContentType[],
      timeframe as SearchTimeframe,
      classificationId
    );

    // Step 2: Filter results
    const relevantItems = await this.filterResults(broadResults, userQuery || '');

    // Step 3: Generate summary - Updated to use o3-mini model
    const { text: finalSummary } = await generateText({
      model: 'o3-mini',
      prompt: `Summarize these ${relevantItems.length} relevant results for the query: "${userQuery}"

        Items:
        ${relevantItems.map(item => item.content.text.slice(0, 200)).join('\n---\n')}

        Include:
        1. Key findings
        2. Patterns or trends
        3. Notable timestamps or events
        4. Suggested next steps`,
    });

    // Record final step
    this.addStep(classificationId, {
      humanAction: 'Search Complete',
      text: `Search Results Summary:
        - Total items found: ${broadResults.length}
        - Relevant items: ${relevantItems.length}
        - Timeframe rationale: ${timeframe.rationale || 'none'}

        ${finalSummary}`,
      finishReason: 'complete',
    });

    return {
      items: relevantItems,
      summary: finalSummary,
      nextStepRecommendation: 'Proceed with classification of filtered items',
    };
  }
}

export const searchWorker = new SearchWorker(); 