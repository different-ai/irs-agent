import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import { pipe } from '@screenpipe/browser';
import { db } from '@/db';
import { supportDocs } from '@/db/schema';

// Schema for time range extraction
const timeRangeSchema = z.object({
  startTime: z.string(),
  endTime: z.string(),
  rawDescription: z.string()
});

// Schema for support documentation
const supportDocSchema = z.object({
  summary: z.string(),
  keyPoints: z.array(z.string()),
  recommendedActions: z.array(z.string())
});

export type TimeRange = z.infer<typeof timeRangeSchema>;
export type SupportDoc = z.infer<typeof supportDocSchema>;

interface ScreenpipeItem {
  text?: string;
  timestamp?: string;
  type?: string;
  metadata?: Record<string, unknown>;
}

export class SupportDocManager {
  private openai: ReturnType<typeof createOpenAI>;

  constructor(apiKey: string) {
    this.openai = createOpenAI({ apiKey });
  }

  async extractTimeRange(sentence: string): Promise<TimeRange> {
    const { object: result } = await generateObject({
      model: this.openai('gpt-4o-mini'),
      schema: timeRangeSchema,
      prompt: `Please parse the user's sentence and determine a timeframe.
user sentence: "${sentence}"

Respond with a timeframe in ISO format. If no specific time is mentioned, default to last 5 minutes.
For relative times like "last 15 minutes", calculate the actual timestamps.

Example response:
{
  "startTime": "2024-02-07T10:00:00Z",
  "endTime": "2024-02-07T10:15:00Z",
  "rawDescription": "user said 'last 15 minutes'"
}`
    });

    // If no time specified, default to last 5 minutes
    if (!result.startTime || !result.endTime) {
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - 5 * 60000);
      return {
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        rawDescription: 'defaulted to last 5 minutes'
      };
    }

    return result;
  }

  async createSupportDoc(items: ScreenpipeItem[]): Promise<SupportDoc> {
    // Format the items into a readable snippet
    const snippet = items.map(item => {
      if (typeof item === 'string') return item;
      return JSON.stringify(item);
    }).join('\n\n');

    const { object: doc } = await generateObject({
      model: this.openai('o3-mini'),
      schema: supportDocSchema,
      prompt: `Create a brief support documentation from this data:
${snippet.slice(0, 3000)}

Focus on:
1. Clear, concise summary
2. Key points that would be useful for support staff
3. Specific recommended actions

Respond with:
{
  "summary": "Brief overview of the situation/issue",
  "keyPoints": ["Important point 1", "Important point 2", ...],
  "recommendedActions": ["Specific action 1", "Specific action 2", ...]
}`
    });

    return doc;
  }

  async handleSupportDocRequest(triggerSentence: string) {
    try {
      // Send initial notification
      await pipe.sendDesktopNotification({
        title: 'Creating support documentation',
        body: "We're gathering context now..."
      });

      // Extract time range
      const timeRange = await this.extractTimeRange(triggerSentence);

      // Query Screenpipe for data
      const results = await pipe.queryScreenpipe({
        contentType: 'audio+ocr',
        startTime: timeRange.startTime,
        endTime: timeRange.endTime,
        includeFrames: false
      });

      if (!results) {
        throw new Error('No data found for the specified timeframe');
      }

      // Generate documentation
      const doc = await this.createSupportDoc(results.data);

      // Store in database
      await db.insert(supportDocs).values({
        timestamp: new Date(),
        summary: doc.summary,
        keyPoints: doc.keyPoints,
        recommendedActions: doc.recommendedActions,
        timeframe: timeRange,
        rawData: results.data
      });

      // Send completion notification
      await pipe.sendDesktopNotification({
        title: 'Support doc created',
        body: 'Click here to view',
        actions: [{ id: 'view', label: 'View doc' }]
      });

      return doc;
    } catch (error) {
      console.error('Error creating support doc:', error);
      throw error;
    }
  }
} 