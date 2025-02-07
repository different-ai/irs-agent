import { openai, createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { useAgentStepsStore } from "@/stores/agent-steps-store";

// updated: planning schema now includes a "searchPlan" structure
export const planningInputSchema = z.object({
  context: z.object({
    type: z.enum(["search", "classification"]),
    query: z.string().optional(),
    timeframe: z.string(),
  }),
  purpose: z.string(),
  apiKey: z.string(),
  classificationId: z.string(),
});

// define a search-plan sub-schema
const searchPlanSchema = z.object({
  timeframe: z
    .object({
      type: z.enum(["specific", "relative", "none"]),
      startTime: z.string(),
      endTime: z.string(),
      rationale: z.string(),
    })
    .required(),
  contentTypes: z.array(z.enum(["ocr", "audio", "ui"])),
  searchQueries: z.array(
    z.object({
      query: z.string(),
      explanation: z.string(),
      expectedResults: z.array(z.string()),
      confidence: z.number(),
    })
  ),
  rationale: z.string(),
});

// updated: planning results now include searchPlan
export const planningResultSchema = z.object({
  steps: z.array(z.string()),
  rationale: z.string(),
  estimatedTimeSeconds: z.number(),
  recommendations: z.array(z.string()),
  searchPlan: searchPlanSchema.required(),
});

export type PlanningInput = z.infer<typeof planningInputSchema>;
export type PlanningResult = z.infer<typeof planningResultSchema>;

// step description schema (for the step logs)
const stepDescriptionSchema = z.object({
  humanAction: z.string(),
  text: z.string(),
});

class PlanningWorker {
  async execute(input: PlanningInput): Promise<PlanningResult> {
    console.log("0xHypr", "planningWorker.execute", input);

    const openai = createOpenAI({ apiKey: input.apiKey });
    const addStep = useAgentStepsStore.getState().addStep;

    // 1) log "start planning" step
    const { object: startStep } = await generateObject({
      model: openai("o3-mini"),
      schema: stepDescriptionSchema,
      system:
        "you are an expert at describing planning activities in clear, human-readable terms.",
      prompt: `create a brief description for starting the planning phase.
context:
- purpose: ${input.purpose}
- type: ${input.context.type}
- query: ${input.context.query || "N/A"}

return a natural description of what we are about to do.`,
    });

    addStep(input.classificationId, {
      humanAction: startStep.humanAction,
      text: startStep.text,
      finishReason: "complete",
    });

    // 2) generate the plan
    const { object: plan } = await generateObject({
      model: openai("o3-mini"),
      schema: planningResultSchema,
      system:
        "you are an expert planner specializing in classification and search strategies.",
      prompt: `
create a detailed plan for: ${input.purpose}
context:
- type: ${input.context.type}
- query: ${input.context.query || "N/A"}
- timeframe: ${input.context.timeframe}

1) produce an overall list of steps ("steps")
2) provide a "rationale" for your approach
3) estimate how many seconds ("estimatedTimeSeconds") it might take
4) give any "recommendations" that might help
5) create a "searchPlan" object with:
   - timeframe: { type, startTime, endTime, rationale }
   - contentTypes: array of relevant content types (ocr, audio, ui)
   - searchQueries: array of { query, explanation, expectedResults, confidence }
   - rationale: a short explanation about why these queries will help
`,
    });

    // 3) log "planning complete" step
    const { object: completionStep } = await generateObject({
      model: openai("o3-mini"),
      schema: stepDescriptionSchema,
      system:
        "you are an expert at describing planning outcomes in clear, human-readable terms.",
      prompt: `create a human-readable description of the completed planning phase.
context:
- steps created: ${plan.steps.length}
- rationale: ${plan.rationale}
- estimated time: ${plan.estimatedTimeSeconds}s
- recommendations: ${plan.recommendations.join(", ")}

return a natural summary of what was accomplished.`,
    });

    addStep(input.classificationId, {
      humanAction: completionStep.humanAction,
      text: completionStep.text,
      finishReason: "complete",
    });

    return plan;
  }
}

export const planningWorker = new PlanningWorker();
