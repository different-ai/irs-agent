"use client";

import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { useAgentStepsStore } from "@/stores/agent-steps-store";

/**
 * Input schema for entity resolution
 */
export const entityResolutionInputSchema = z.object({
  userQuery: z.string(),
  apiKey: z.string(),
  classificationId: z.string(),
});

/**
 * Output schema from entity resolution
 */
export const entityResolutionResultSchema = z.object({
  resolvedQuery: z.string(),
  synonyms: z.array(z.string()),
  explanation: z.string(),
});

export type EntityResolutionInput = z.infer<typeof entityResolutionInputSchema>;
export type EntityResolutionResult = z.infer<typeof entityResolutionResultSchema>;

class EntityResolutionWorker {
  private addStep!: (classificationId: string, step: any) => void;

  async execute(input: EntityResolutionInput): Promise<EntityResolutionResult> {
    this.addStep = useAgentStepsStore.getState().addStep;

    // set up the OpenAI client
    const openai = createOpenAI({ apiKey: input.apiKey });

    // log we are starting entity resolution
    this.addStep(input.classificationId, {
      humanAction: "entity-resolution started",
      text: `resolving entities in query: "${input.userQuery}"`,
      finishReason: "complete",
    });

    // call an LLM to parse out synonyms/variations of the user’s query
    const { object: result } = await generateObject({
      model: openai("o3-mini"),
      schema: entityResolutionResultSchema,
      system: "you are an expert at detecting name variations/synonyms in user queries",
      prompt: `
The user query is: "${input.userQuery}"

1) Identify any name variations or synonyms. 
2) Construct a "resolvedQuery" that might combine them with OR, e.g. "alex OR alexander", if relevant.
3) Provide a short explanation.

Return JSON with { resolvedQuery, synonyms, explanation }.
`,
    });

    // log result
    this.addStep(input.classificationId, {
      humanAction: "entity-resolution complete",
      text: `resolvedQuery: ${result.resolvedQuery}\nsynonyms: ${result.synonyms.join(", ")}`,
      finishReason: "complete",
    });

    return result;
  }
}

export const entityResolutionWorker = new EntityResolutionWorker();