"use client";

import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { useAgentStepsStore } from "@/stores/agent-steps-store";

/**
 * Input schema for timeframe parsing
 */
export const timeframeWorkerInputSchema = z.object({
  userQuery: z.string(),
  apiKey: z.string(),
  classificationId: z.string(),
});

/**
 * Output schema from timeframe parsing
 */
export const timeframeWorkerResultSchema = z.object({
  type: z.enum(["none", "relative", "specific"]),
  startTime: z.string(), // iso8601 or empty
  endTime: z.string(),   // iso8601 or empty
  explanation: z.string(),
});

export type TimeframeWorkerInput = z.infer<typeof timeframeWorkerInputSchema>;
export type TimeframeWorkerResult = z.infer<typeof timeframeWorkerResultSchema>;

class TimeframeWorker {
  private addStep!: (classificationId: string, step: any) => void;

  async execute(input: TimeframeWorkerInput): Promise<TimeframeWorkerResult> {
    this.addStep = useAgentStepsStore.getState().addStep;
    const openai = createOpenAI({ apiKey: input.apiKey });

    // log we are starting
    this.addStep(input.classificationId, {
      humanAction: "timeframe parsing started",
      text: `analyzing timeframe in query: "${input.userQuery}"`,
      finishReason: "complete",
    });

    // call LLM to interpret natural language time references
    const { object: result } = await generateObject({
      model: openai("o3-mini"),
      schema: timeframeWorkerResultSchema,
      system: "you parse time expressions like 'yesterday', 'last week', 'jan 1 to jan 10', etc. into a start/end iso string",
      prompt: `
User query: "${input.userQuery}"

1) If the user used a relative date (like "yesterday", "this month"), produce type="relative" plus startTime/endTime. 
2) If a specific date range was stated, produce type="specific". 
3) If no mention of time, produce type="none", with empty or minimal placeholders for startTime/endTime.
4) Provide "explanation" for how you interpreted it.
`,
    });

    // log the result
    this.addStep(input.classificationId, {
      humanAction: "timeframe parsing complete",
      text: `parsed timeframe => ${result.type}: ${result.startTime} to ${result.endTime}`,
      finishReason: "complete",
    });

    return result;
  }
}

export const timeframeWorker = new TimeframeWorker();