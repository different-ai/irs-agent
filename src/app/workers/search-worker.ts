// src/app/workers/search-worker.ts

import { createOpenAI } from "@ai-sdk/openai";
import { generateObject, generateText } from "ai";
import { z } from "zod";
import { useAgentStepsStore } from "@/stores/agent-steps-store";
import { pipe } from "@screenpipe/browser";
import type { ContentType } from "@screenpipe/browser";

// same input schema as before
export const searchInputSchema = z.object({
  query: z.string(),
  timeframe: z.string(),
  purpose: z.string(),
  context: z.object({
    type: z.string(),
    query: z.string(),
    timeframe: z.string(),
  }),
  apiKey: z.string(),
  classificationId: z.string(),
});

export const searchResultSchema = z.object({
  items: z.array(z.any()), // or a more specific shape
  summary: z.string(),
  nextStepRecommendation: z.string(),
});

type SearchInput = z.infer<typeof searchInputSchema>;
type SearchResult = z.infer<typeof searchResultSchema>;

// minimal timeframe definition if you like
type SearchTimeframe = {
  startTime?: string;
  endTime?: string;
};

class SearchWorker {
  private addStep: (classificationId: string, step: any) => void;
  private openai: any;

  constructor() {
    this.addStep = () => {};
    this.openai = null;
  }

  /**
   * We'll parse the synonyms from the entity resolution worker if they're available.
   * If not, we can fallback to something short from the user query.
   */
  private async getSearchSynonyms(input: SearchInput) {
    // if you have an "entity resolution result" stored somewhere or in input, use that.
    // otherwise, do a quick LLM call to strip fluff from user query.
    // for example, if plan.query is "what was my last convo with louis",
    // we want synonyms = ["louis", "louie", "lewis"] only.

    // check if user query is already short
    if (input.query.split(/\s+/).length <= 2) {
      // user query is already short
      return {
        synonyms: [input.query.trim()],
        explanation: "User query is already short, no extra fluff removed.",
      };
    }

    // otherwise, do a short prompt that extracts only key terms:
    const { object: queryAnalysis } = await generateObject({
      model: this.openai("o3-mini"),
      schema: z.object({
        synonyms: z.array(z.string()),
        explanation: z.string(),
      }),
      prompt: `
User query: "${input.query}"
We only want short, single or short-phrase synonyms. 
No extra words like "conversation" or "context."

Return JSON:
{
  "synonyms": [...], 
  "explanation": "..."
}
`,
    });

    if (!queryAnalysis.synonyms || queryAnalysis.synonyms.length === 0) {
      // fallback
      return { synonyms: [input.query], explanation: "No synonyms found" };
    }

    return queryAnalysis;
  }

  /**
   * run multiple queries or a single OR-based query with synonyms
   */
  private async executeQueries(
    synonyms: string[],
    timeframe: SearchTimeframe,
    classificationId: string
  ) {
    const contentType: ContentType = "ocr"; // or just 'ocr' if you want
    // unify results across queries
    let allResults: any[] = [];

    // approach A: one combined OR-based query
    // e.g. "louis OR louie OR lewis"
    // short and sweet:
    const combinedOR = synonyms.join(" OR ");

    this.addStep(classificationId, {
      humanAction: "search progress",
      text: `Performing a simple search: "${combinedOR}" in ${contentType}`,
      finishReason: "complete",
    });

    try {
      const searchResults = await pipe.queryScreenpipe({
        q: combinedOR,
        contentType,
        startTime: timeframe.startTime || "",
        endTime: timeframe.endTime || "",
        limit: 50,
        minLength: 3,
        includeFrames: false,
      });
      if (searchResults?.data) {
        allResults = allResults.concat(
          searchResults.data.map((r) => ({
            type: contentType,
            content: r.content,
          }))
        );
      }
    } catch (err) {
      console.error("search error:", err);
      this.addStep(classificationId, {
        humanAction: "search error",
        text: `error executing search with combined OR: ${err.message}`,
        finishReason: "error",
      });
    }

    // approach B: if you want multiple single-term queries (optional):
    // for (const term of synonyms) {
    //   this.addStep(classificationId, {
    //     humanAction: 'search progress',
    //     text: `Performing search: "${term}" in ${contentType}`,
    //     finishReason: 'complete',
    //   });
    //   try {
    //     const searchResults = await pipe.queryScreenpipe({
    //       q: term,
    //       contentType,
    //       startTime: timeframe.startTime || '',
    //       endTime: timeframe.endTime || '',
    //       limit: 50,
    //       minLength: 3,
    //       includeFrames: false,
    //     });
    //     if (searchResults?.data) {
    //       allResults = allResults.concat(
    //         searchResults.data.map(r => ({
    //           type: contentType,
    //           content: r.content,
    //         }))
    //       );
    //     }
    //   } catch (err) {
    //     console.error('search error:', err);
    //     this.addStep(classificationId, {
    //       humanAction: 'search error',
    //       text: `error executing search with term "${term}": ${err.message}`,
    //       finishReason: 'error',
    //     });
    //   }
    // }

    return allResults;
  }

  /**
   * quick filter step to ensure results are relevant
   */
  private async filterResults(
    results: any[],
    userQuery: string,
    classificationId: string
  ) {
    const relevantItems: any[] = [];

    // if you still want a quick relevancy check:
    const chunk = results.slice(0, 20);
    const chunkPrompt = chunk
      .map((item, idx) => {
        const shortText = item.content.text?.replace(/\n/g, " ").slice(0, 250);
        return `item ${idx}, timestamp: ${item.content.timestamp}\n"${shortText}"\n`;
      })
      .join("\n");

    // do an LLM call to label them relevant or not
    const { object: filterDecision } = await generateObject({
      model: this.openai("o3-mini"),
      schema: z.object({
        results: z.array(
          z.object({
            relevant: z.boolean(),
            reason: z.string(),
          })
        ),
      }),
      prompt: `
User query: "${userQuery}"
We have up to 20 results. For each item, decide if it's relevant or not to the user query.

items:
${chunkPrompt}

Return JSON array: [{"relevant": bool, "reason": "..."}...]
`,
    });

    filterDecision.results.forEach((decision: any, idx: number) => {
      if (decision.relevant) {
        relevantItems.push({
          ...chunk[idx],
          relevanceReason: decision.reason,
        });
      }
    });

    this.addStep(classificationId, {
      humanAction: "filter progress",
      text: `filtered ${chunk.length} items, found ${relevantItems.length} relevant`,
      finishReason: "complete",
    });

    return relevantItems;
  }

  // orchestrate the entire simplified search process
  async execute(input: SearchInput): Promise<SearchResult> {
    this.openai = createOpenAI({ apiKey: input.apiKey });
    this.addStep = useAgentStepsStore.getState().addStep;

    // 1) get synonyms from entity resolution (or minimal parse)
    const { synonyms, explanation } = await this.getSearchSynonyms(input);

    this.addStep(input.classificationId, {
      humanAction: "analyze query done",
      text: `Synonyms used: ${synonyms.join(", ")}\nExplanation: ${explanation}`,
      finishReason: "complete",
    });

    // 2) parse timeframe (if relevant). we assume input.timeframe is just a string.
    // if your timeframe worker sets start/end times somewhere else, adapt accordingly.
    const timeframe: SearchTimeframe = {};

    // 3) do simplified queries
    const broadResults = await this.executeQueries(
      synonyms,
      timeframe,
      input.classificationId
    );

    // 4) filter for relevance
    const relevantItems = await this.filterResults(
      broadResults,
      input.query,
      input.classificationId
    );

    // 5) optional summarization
    const { text: finalSummary } = await generateText({
      model: this.openai("o3-mini"),
      prompt: `
We found ${relevantItems.length} relevant results for the query "${input.query}".
Synonyms: ${synonyms.join(", ")}

items sample:
${relevantItems
  .slice(0, 3)
  .map((item) => item.content.text?.slice(0, 300))
  .join("\n---\n")}

Write a short bullet summary (1-3 points) about these results. 
`,
    });

    // log final step
    this.addStep(input.classificationId, {
      humanAction: "search complete",
      text: `
search results summary:
- total items found: ${broadResults.length}
- relevant items: ${relevantItems.length}
- final summary: ${finalSummary}
`,
      finishReason: "complete",
    });

    return {
      items: relevantItems,
      summary: finalSummary,
      nextStepRecommendation: "proceed with analysis or final answer",
    };
  }
}

export const searchWorker = new SearchWorker();