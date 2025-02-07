// orchestrate-classification.ts

"use client";

import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import { planningWorker } from './workers/planning-worker';
import { searchWorker } from './workers/search-worker';
import { answerWorker } from './workers/answer-worker';
import { entityResolutionWorker } from './workers/entity-resolution-worker';
import { timeframeWorker } from './workers/timeframe-worker';
import { analysisWorker } from './workers/analysis-worker';
import { useAgentStepsStore } from '@/stores/agent-steps-store';

// Updated schema to include new step types
export const orchestrationPlanSchema = z.object({
  type: z.enum(['search', 'classification']),
  query: z.string(),
  timeframe: z.string(),
  steps: z.array(z.object({
    type: z.enum([
      'planning',
      'entity-resolution',
      'timeframe',
      'search',
      'analysis',
      'answer'
    ]),
    purpose: z.string(),
    context: z.object({
      type: z.enum(['search', 'classification']),
      query: z.string(),
      timeframe: z.string(),
    }),
  })),
  estimatedComplexity: z.enum(['low', 'medium', 'high']),
});

export type OrchestrationPlan = z.infer<typeof orchestrationPlanSchema>;

interface WorkerResult {
  // Analysis worker results
  summary?: string;
  recommendedItems?: string[];
  explanation?: string;
  conversationSnippet?: string;
  
  // Answer worker results
  answer?: string;
  
  // Entity resolution worker results
  entities?: string[];
  
  // Timeframe worker results
  timeframe?: string;
  
  // Search worker results
  items?: Array<{
    text: string;
    timestamp: string;
    content?: {
      text?: string;
      timestamp?: string;
    };
  }>;
  
  // Planning worker results
  steps?: string[];
  searchPlan?: {
    timeframe: {
      type: "specific" | "relative" | "none";
      startTime: string;
      endTime: string;
      rationale: string;
    };
    rationale: string;
    contentTypes: ("audio" | "ocr" | "ui")[];
    searchQueries: {
      query: string;
      explanation: string;
      expectedResults: string[];
      confidence: number;
    }[];
  };
  rationale?: string;
  estimatedTimeSeconds?: number;
  recommendations?: string[];
}

export async function orchestrateClassification(
  searchQuery?: string,
  systemInstructions?: string,
  apiKey?: string,
  classificationId?: string
) {
  if (!apiKey) {
    throw new Error('API key is required for classification');
  }

  if (!classificationId) {
    throw new Error('Classification ID is required for tracking steps');
  }

  console.log('0xHypr', 'orchestrateClassification', { searchQuery });
  
  const openai = createOpenAI({ apiKey });
  const addStep = useAgentStepsStore.getState().addStep;

  // Step: user started the entire process
  addStep(classificationId, {
    humanAction: 'Starting classification orchestration',
    text: `Planning the process for query: "${searchQuery}"`,
    finishReason: 'complete',
  });

  // 1. Generate an orchestration plan
  const { object: plan } = await generateObject({
    model: openai('o3-mini'),
    schema: orchestrationPlanSchema,
    prompt: `Create a plan for searching content and producing a final answer:
    User's query: "${searchQuery}"
    ${systemInstructions || ''}
    
    Include steps for:
    1) Entity resolution (if needed)
    2) Timeframe parsing (if needed)
    3) Search execution
    4) Result analysis
    5) Final answer generation`,
  });

  console.log('0xHypr', 'orchestrateClassification - plan', plan);

  // Step: show plan
  addStep(classificationId, {
    humanAction: 'Generated plan',
    text: `Complexity: ${plan.estimatedComplexity}\nSteps: ${plan.steps
      .map((s) => s.type + ': ' + s.purpose)
      .join(' → ')}`,
    finishReason: 'complete',
  });

  // 2. Execute steps
  const results: WorkerResult[] = [];
  let lastResult: WorkerResult | null = null;

  for (const step of plan.steps) {
    let result: WorkerResult;

    switch (step.type) {
      case 'planning':
        result = await planningWorker.execute({
          context: {
            type: plan.type,
            query: plan.query,
            timeframe: plan.timeframe,
          },
          purpose: step.purpose,
          apiKey,
          classificationId,
        });
        break;

      case 'entity-resolution':
        result = await entityResolutionWorker.execute({
          userQuery: plan.query,
          apiKey,
          classificationId,
        });
        break;

      case 'timeframe':
        result = await timeframeWorker.execute({
          userQuery: plan.query,
          apiKey,
          classificationId,
        });
        break;

      case 'search':
        result = await searchWorker.execute({
          query: plan.query,
          timeframe: plan.timeframe,
          purpose: step.purpose,
          context: step.context,
          apiKey,
          classificationId,
        });
        break;

      case 'analysis':
        result = await analysisWorker.execute({
          searchResults: lastResult,
          analysisGoal: step.purpose,
          apiKey,
          classificationId,
        });
        break;

      case 'answer':
        result = await answerWorker.execute({
          searchResults: lastResult,
          purpose: step.purpose,
          context: {
            type: plan.type,
            query: plan.query,
            timeframe: plan.timeframe,
          },
          apiKey,
          classificationId,
        });
        break;
    }

    lastResult = result;
    results.push(result);
  }

  // Final step
  addStep(classificationId, {
    humanAction: 'Classification process completed',
    text: `Processed ${plan.steps.length} steps successfully`,
    finishReason: 'complete',
  });

  return {
    plan,
    results,
  };
}