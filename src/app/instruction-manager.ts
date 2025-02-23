import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import { pipe } from '@screenpipe/browser';
import { db } from '@/db';
import { supportDocs, financialActivities } from '@/db/schema';
import { financeWorker } from '@/lib/workers/finance-worker';

// Schema for extracting a time range from an instruction
const timeRangeSchema = z.object({
  startTime: z.string(),
  endTime: z.string(),
  rawDescription: z.string(),
});

// Schema for summarization result
const summarySchema = z.object({
  summary: z.string(),
  keyPoints: z.array(z.string()),
  topics: z.array(z.string()),
  sentiment: z.enum(['positive', 'neutral', 'negative']),
});

export type TimeRange = z.infer<typeof timeRangeSchema>;
export type SummaryResult = z.infer<typeof summarySchema>;

interface ScreenpipeItem {
  content?: {
    text?: string;
    timestamp?: string;
  };
  metadata?: Record<string, unknown>;
}

export class InstructionManager {
  private openai: ReturnType<typeof createOpenAI>;

  constructor(apiKey: string) {
    this.openai = createOpenAI({ apiKey });
  }

  // Use GPT-4o Mini to parse the instruction for a time range
  async extractTimeRange(instruction: string): Promise<TimeRange> {
    const { object: result } = await generateObject({
      model: this.openai('gpt-4o-mini'),
      schema: timeRangeSchema,
      prompt: `Please parse the following instruction and determine a timeframe in ISO format.
Current time: ${new Date().toISOString()}
Instruction: "${instruction}"

If no specific time is mentioned, default to the last 5 minutes.
For relative times like "last 15 minutes", calculate the actual timestamps.

Example response:
{
  "startTime": "2024-02-07T10:00:00Z",
  "endTime": "2024-02-07T10:05:00Z",
  "rawDescription": "user said 'last 5 minutes'"
}`,
    });

    // Default to last 5 minutes if the result is incomplete
    if (!result.startTime || !result.endTime) {
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - 5 * 60000);
      return {
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        rawDescription: 'defaulted to last 5 minutes',
      };
    }
    return result;
  }

  // Use o3-mini to summarize Screenpipe data
  async summarizeScreenpipeData(
    items: ScreenpipeItem[],
    instruction: string
  ): Promise<SummaryResult> {
    // Format the items into a readable snippet
    const snippet = items
      .map(item => {
        const ts = item.content?.timestamp || 'unknown time';
        const text = item.content?.text?.trim() || '[no text]';
        return `${ts}:\n${text}`;
      })
      .join('\n\n');

    const { object: result } = await generateObject({
      model: this.openai('o3-mini'),
      schema: summarySchema,
      prompt: `Please analyze and summarize the following conversation context based on the user's instruction.

User's instruction: "${instruction}"
Current time: ${new Date().toISOString()}

Conversation transcript:
${snippet.slice(0, 3000)}

Focus on:
1. Providing a clear, concise summary
2. Identifying key discussion points
3. Listing main topics covered
4. Determining overall sentiment

Respond with a JSON object containing:
{
  "summary": "Brief but comprehensive summary",
  "keyPoints": ["Important point 1", "Important point 2", ...],
  "topics": ["Main topic 1", "Main topic 2", ...],
  "sentiment": "positive|neutral|negative"
}`,
    });

    return result;
  }

  async processFinancialActivity(text: string, source: string) {
    try {
      const result = await financeWorker.execute({
        text,
        timestamp: new Date().toISOString(),
        source,
      }, {
        apiKey: this.apiKey,
        classificationId: crypto.randomUUID(),
        query: text,
        timeframe: {
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
          type: 'specific',
        },
      });

      if (result) {
        // Store in database
        await db.insert(financialActivities).values({
          timestamp: new Date(),
          type: result.type,
          amount: result.amount,
          currency: result.currency,
          description: result.description,
          senderName: result.parties.find(p => p.role === 'sender')?.name,
          receiverName: result.parties.find(p => p.role === 'receiver')?.name,
          confidence: result.confidence,
          sourceText: text,
          sourceType: source,
        });

        // Send notification
        await pipe.sendDesktopNotification({
          title: 'Financial Activity Detected',
          body: `${result.type}: ${result.amount} ${result.currency}\n${result.description}`,
          actions: [{ id: 'view', label: 'View Details' }],
        });
      }
    } catch (error) {
      console.error('Error processing financial activity:', error);
    }
  }

  async handleInstructionRequest(instruction: string): Promise<SummaryResult> {
    try {
      // Send initial notification
      await pipe.sendDesktopNotification({
        title: 'Processing Instruction',
        body: "Gathering context and generating summary...",
      });

      // Extract time range based on the instruction
      const timeRange = await this.extractTimeRange(instruction);
      console.log('Extracted time range:', timeRange);

      // Query Screenpipe using the extracted time range
      const results = await pipe.queryScreenpipe({
        contentType: 'audio+ocr',
        startTime: timeRange.startTime,
        endTime: timeRange.endTime,
        includeFrames: false,
      });

      if (!results?.data) {
        throw new Error('No data found for the specified timeframe');
      }

      // Generate summary from Screenpipe data
      const summary = await this.summarizeScreenpipeData(results.data, instruction);

      // Store in database
      await db.insert(supportDocs).values({
        timestamp: new Date(),
        summary: summary.summary,
        keyPoints: summary.keyPoints,
        recommendedActions: [], // Could be generated from key points if needed
        timeframe: timeRange,
        rawData: results.data,
      });

      // Process for financial activity
      await this.processFinancialActivity(instruction, 'instruction');

      // Send completion notification
      await pipe.sendDesktopNotification({
        title: 'Instruction Processed',
        body: 'Summary generated and saved',
        actions: [{ id: 'view', label: 'View Summary' }],
      });

      return summary;
    } catch (error) {
      console.error('Error processing instruction:', error);
      throw error;
    }
  }
} 