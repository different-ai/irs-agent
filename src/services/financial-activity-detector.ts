import { pipe } from '@screenpipe/browser';
import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import { db } from '@/db';
import { financialActivities } from '@/db/schema';

// Keywords to match for financial activities
const FINANCIAL_KEYWORDS = {
  invoice: ['invoice', 'bill', 'charge'],
  payment: ['payment', 'paid', 'transferred', 'sent'],
  receipt: ['receipt', 'received', 'got paid'],
  subscription: ['subscription', 'monthly fee', 'recurring']
};

// Schema for financial activity detection
const financialActivitySchema = z.object({
  type: z.enum(['invoice', 'payment', 'receipt', 'subscription']),
  amount: z.number(),
  currency: z.string(),
  description: z.string(),
  senderName: z.string().nullable(),
  receiverName: z.string().nullable(),
  confidence: z.number(),
  sourceText: z.string(),
  sourceType: z.string()
});

export class FinancialActivityDetector {
  private openai: ReturnType<typeof createOpenAI>;
  private isRunning = false;

  constructor(apiKey: string) {
    this.openai = createOpenAI({ apiKey });
  }

  private containsFinancialKeywords(text: string): string | null {
    console.log('containsFinancialKeywords', text);
    const lowerText = text.toLowerCase();
    for (const [type, keywords] of Object.entries(FINANCIAL_KEYWORDS)) {
      if (keywords.some(keyword => lowerText.includes(keyword))) {
        return type;
      }
    }
    return null;
  }

  private async processContent(text: string, type: string): Promise<void> {
    console.log('processing content', text, type);
    const keywordMatch = this.containsFinancialKeywords(text);
    if (!keywordMatch) return;

    try {
      // Use LLM to extract structured information
      const { object: activity } = await generateObject({
        model: this.openai('o3-mini'),
        schema: financialActivitySchema,
        prompt: `Extract financial activity information from this text:
"${text}"

The text appears to be about a ${keywordMatch}. Extract the following:
1. Exact type (invoice/payment/receipt/subscription)
2. Amount and currency
3. Description
4. Sender and receiver names if present
5. Assign a confidence score (0-1)

Only extract if you're confident this is a real financial activity.`
      });

      // Store in database if confidence is high enough
      if (activity.confidence > 0.7) {
        await db.insert(financialActivities).values({
          timestamp: new Date(),
          type: activity.type,
          amount: activity.amount.toString(),
          currency: activity.currency,
          description: activity.description,
          senderName: activity.senderName,
          receiverName: activity.receiverName,
          confidence: activity.confidence.toString(),
          sourceText: activity.sourceText,
          sourceType: type
        });

        // Send notification
        await pipe.sendDesktopNotification({
          title: 'New Financial Activity Detected',
          body: `${activity.type}: ${activity.amount} ${activity.currency}`,
          timeout: 5000
        });
      }
    } catch (error) {
      console.error('Error processing financial activity:', error);
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      // Start audio stream
      // const audioStream = pipe.streamTranscriptions();
      // (async () => {
      //   for await (const chunk of audioStream) {
      //     if (!this.isRunning) break;
      //     if (chunk.metadata?.timestamp && chunk.choices[0]?.text) {
      //       await this.processContent(
      //         chunk.choices[0].text,
      //         'audio',
      //         chunk.metadata.timestamp
      //       );
      //     }
      //   }
      // })().catch(console.error);

      // Start OCR stream
      console.log('starting vision stream');
      const visionStream = pipe.streamVision(false);
      console.log('vision stream', visionStream);
      (async () => {
        for await (const event of visionStream) {
          if (!this.isRunning) break;
          // ignore app name includes cursor
          if (event.data.Ocr.text ) {
            await this.processContent(
              event.data.Ocr.text,
              'ocr',
            );
          }
        }
      })().catch(console.error);

    } catch (error) {
      console.error('Error starting financial activity detector:', error);
      this.isRunning = false;
    }
  }

  stop(): void {
    this.isRunning = false;
  }
} 