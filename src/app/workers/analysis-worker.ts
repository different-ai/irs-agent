// analysis-worker.ts

"use client";

import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import { useAgentStepsStore } from '@/stores/agent-steps-store';

export const analysisWorkerInputSchema = z.object({
  searchResults: z.any(),
  analysisGoal: z.string(),  // e.g. "summarize the last conversation with louis"
  apiKey: z.string(),
  classificationId: z.string(),
});

export const analysisWorkerResultSchema = z.object({
  summary: z.string(),
  recommendedItems: z.array(z.string()),
  explanation: z.string(),
  // add a new field for actual conversation text
  conversationSnippet: z.string(),
});

export type AnalysisWorkerInput = z.infer<typeof analysisWorkerInputSchema>;
export type AnalysisWorkerResult = z.infer<typeof analysisWorkerResultSchema>;

interface AgentStep {
  humanAction: string;
  text: string;
  finishReason: 'complete' | 'error' | null;
}

class AnalysisWorker {
  private addStep!: (classificationId: string, step: Partial<AgentStep>) => void;
  private openai!: ReturnType<typeof createOpenAI>;

  async execute(input: AnalysisWorkerInput): Promise<AnalysisWorkerResult> {
    this.addStep = useAgentStepsStore.getState().addStep;
    this.openai = createOpenAI({ apiKey: input.apiKey });

    // step: log start
    this.addStep(input.classificationId, {
      humanAction: 'analysis started',
      text: `Analyzing search results to accomplish: "${input.analysisGoal}"`,
      finishReason: 'complete',
    });

    const items = input.searchResults?.items || [];

    // we can do a simple sort by timestamp if present:
    const sorted = [...items].sort((a, b) => {
      const tA = new Date(a.content?.timestamp || 0).getTime();
      const tB = new Date(b.content?.timestamp || 0).getTime();
      return tA - tB;
    });

    // create a conversation snippet (just join the text lines in ascending timestamp)
    const conversationSnippet = sorted
      .map(item => {
        const ts = item.content?.timestamp || 'unknown time';
        const text = item.content?.text?.trim() || '[no text]';
        return `${ts}:\n${text}`;
      })
      .join('\n\n');

    // call LLM for a short meta-summarization if you want
    const { object: analysis } = await generateObject({
      model: this.openai('o3-mini'),
      schema: z.object({
        summary: z.string(),
        recommendedItems: z.array(z.string()),
        explanation: z.string(),
      }),
      system: 'you interpret the analysisGoal to produce a meta summary and explanation.',
      prompt: `
We have sorted conversation items from the user's search.
analysisGoal: "${input.analysisGoal}"

conversation snippet:
${conversationSnippet.slice(0, 3000)}

1) Provide "summary" of the conversation
2) Provide an array "recommendedItems" with key points
3) Provide "explanation" about how you derived them
`,
    });

    // log end
    this.addStep(input.classificationId, {
      humanAction: 'analysis complete',
      text: `analysis summary: ${analysis.summary}`,
      finishReason: 'complete',
    });

    return {
      summary: analysis.summary,
      recommendedItems: analysis.recommendedItems,
      explanation: analysis.explanation,
      conversationSnippet, // the actual text for the final answer
    };
  }
}

export const analysisWorker = new AnalysisWorker();