// answer-worker.ts

"use client";

import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { z } from 'zod';
import { useAgentStepsStore } from '@/stores/agent-steps-store';

export const answerInputSchema = z.object({
  searchResults: z.any().optional(),
  purpose: z.string(),
  context: z.record(z.any()).optional(),
  apiKey: z.string(),
  classificationId: z.string(),
});

export const answerResultSchema = z.object({
  answer: z.string(),
});

export type AnswerInput = z.infer<typeof answerInputSchema>;
export type AnswerResult = z.infer<typeof answerResultSchema>;

interface AgentStep {
  humanAction: string;
  text: string;
  finishReason: 'complete' | 'error' | null;
}

class AnswerWorker {
  private addStep!: (classificationId: string, step: Partial<AgentStep>) => void;
  private openai!: ReturnType<typeof createOpenAI>;

  constructor() {
    this.addStep = () => {};
    this.openai = createOpenAI({ apiKey: '' });
  }

  async execute(input: AnswerInput): Promise<AnswerResult> {
    this.addStep = useAgentStepsStore.getState().addStep;
    this.openai = createOpenAI({ apiKey: input.apiKey });

    // step: show user we're about to generate final answer
    this.addStep(input.classificationId, {
      humanAction: 'Generating final answer',
      text: `Taking the search results and summarizing them into a short answer. Purpose: ${input.purpose}`,
      finishReason: 'complete',
    });

    // pull out the conversation snippet from analysis
    const snippet = input.searchResults?.conversationSnippet || '';
    const partialSummary = input.searchResults?.summary || '';
    // combine them for a more thorough final answer prompt
    const finalPrompt = `
We have the following conversation snippet from the most recent logs:

${snippet.slice(0, 4000)}

A short meta-summary was: "${partialSummary}"

User wants a direct answer for: "${input.purpose}"

If the user is specifically asking "What was the last conversation with Louis about?" or "What was said?", provide the actual conversation content (excerpts) in a concise manner.

Output no more than ~10 lines. Summarize if needed, but preserve actual meaning.
`.trim();

    // call llm to refine the final text
    const { text } = await generateText({
      model: this.openai('o3-mini'),
      prompt: finalPrompt,
    });

    // add step to show final answer
    this.addStep(input.classificationId, {
      humanAction: 'Answer generated',
      text,
      finishReason: 'complete',
    });

    return { answer: text };
  }
}

export const answerWorker = new AnswerWorker();