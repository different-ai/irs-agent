"use client";

import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import { useAgentStepsStore } from '@/stores/agent-steps-store';

export const searchPlanInputSchema = z.object({
  query: z.string(),
  timeframe: z.object({
    type: z.enum(['specific', 'relative', 'none']),
    startTime: z.string(),
    endTime: z.string(),
  }),
  purpose: z.string(),
  apiKey: z.string(),
  classificationId: z.string(),
}).required();

export const searchPlanSchema = z.object({
  searchQuery: z.string(),
  contentType: z.enum(['ocr', 'audio', 'ui']),
  rationale: z.string(),
  expectedResults: z.array(z.string()),
}).required();

export type SearchPlanInput = z.infer<typeof searchPlanInputSchema>;
export type SearchPlan = z.infer<typeof searchPlanSchema>;

class SearchPlanWorker {
  private addStep!: (classificationId: string, step: any) => void;
  private openai!: ReturnType<typeof createOpenAI>;

  constructor() {
    this.addStep = () => {};
    this.openai = createOpenAI({ apiKey: '' });
  }

  async execute(input: SearchPlanInput): Promise<SearchPlan> {
    this.addStep = useAgentStepsStore.getState().addStep;
    this.openai = createOpenAI({ apiKey: input.apiKey });

    this.addStep(input.classificationId, {
      humanAction: 'Creating search plan',
      text: `Analyzing query: "${input.query}" to determine best search approach`,
      finishReason: 'complete',
    });

    const { object: plan } = await generateObject({
      model: this.openai('o3-mini'),
      schema: searchPlanSchema,
      prompt: `Create a focused search plan for: "${input.query}"

Context:
- Purpose: ${input.purpose}
- Timeframe: ${input.timeframe.type} (${input.timeframe.startTime} to ${input.timeframe.endTime})

Guidelines:
1. Create ONE clear, focused search query
2. Choose ONE content type (ocr/audio/ui) that's most likely to have relevant results
3. Explain your rationale
4. List what kind of results you expect to find

Example:
Query: "What was my last conversation with Alex about budgets?"
Plan:
{
  "searchQuery": "Alex budget",
  "contentType": "audio",
  "rationale": "Audio content likely contains conversation details",
  "expectedResults": [
    "Meeting recordings with Alex discussing budget",
    "Voice notes about budget planning"
  ]
}

Keep the search query simple and direct.`,
    });

    this.addStep(input.classificationId, {
      humanAction: 'Search plan created',
      text: `Will search for: "${plan.searchQuery}" in ${plan.contentType}\nRationale: ${plan.rationale}`,
      finishReason: 'complete',
    });

    return plan;
  }
}

export const searchPlanWorker = new SearchPlanWorker(); 