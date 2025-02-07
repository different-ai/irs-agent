"use server";
import { pipe, ContentItem } from "@screenpipe/js";
import { planningWorker } from "./workers/planning-worker";

interface ScreenpipeResponse {
  data?: ContentItem[];
}

// Helper function to get settings
async function getSettings() {
  const settingsManager = pipe.settings;
  if (!settingsManager) {
    throw new Error("settingsManager not found");
  }
  return await settingsManager.getAll();
}

export const interpretSearch = async (query: string, classificationId: string) => {
  try {
    // Get API key from settings
    const settings = await getSettings();
    const apiKey = settings.openaiApiKey;

    if (!apiKey) {
      throw new Error("OpenAI API key not found in settings");
    }

    // Create search plan
    const searchPlan = await planningWorker.createSearchPlan(query, apiKey);
    console.log('Search plan:', searchPlan);

    // Execute search for each content type
    const results = [];
    
    for (const contentType of searchPlan.contentTypes) {
      const response = await pipe.queryScreenpipe({
        q: query,
        contentType,
        startTime: searchPlan.timeframe.startTime,
        endTime: searchPlan.timeframe.endTime,
      });

      if (response?.data) {
        results.push(...response.data);
      }
    }

    // Format results
    const formattedResults = results
      .filter((result): result is ContentItem & { content: { text: string } } => 
        !!result && 'content' in result && 'text' in result.content
      )
      .map(result => ({
        text: result.content.text,
        timestamp: new Date().toISOString(),
        appName: result.content.app_name || 'Unknown'
      }));

    return `Found ${formattedResults.length} results for "${query}"\n\n${
      formattedResults.map(r => `[${r.timestamp}] ${r.text}`).join('\n')
    }`;
  } catch (err) {
    console.error("Search error:", err);
    throw err;
  }
};
