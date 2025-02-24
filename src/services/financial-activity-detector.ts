import { pipe } from '@screenpipe/browser';
import { createOllama, ollama } from 'ollama-ai-provider';
import { generateObject } from 'ai';
import { z } from 'zod';
import { db } from '@/db';
import { financialActivities } from '@/db/schema';
import { EventEmitter } from 'events';

// Keywords to match for financial activities
const FINANCIAL_KEYWORDS = {
  invoice: ['invoice', 'bill', 'charge'],
  payment: ['payment', 'paid', 'transferred', 'sent'],
  receipt: ['receipt', 'received', 'got paid'],
  subscription: ['subscription', 'monthly fee', 'recurring']
};

// Schema for financial activity detection
const financialActivitySchema = z.object({
  type: z.enum(['invoice', 'payment', 'receipt', 'subscription']).nullable(),
  amount: z.number().nullable(),
  currency: z.string().nullable(),
  description: z.string().nullable(),
  senderName: z.string().nullable(),
  receiverName: z.string().nullable(),
  confidence: z.number().nullable(),
  sourceText: z.string().nullable(),
  sourceType: z.string().nullable()
});

interface VisionEvent {
  data: {
    text: string;
    app_name: string;
    image?: string;
    timestamp?: string;
  }
}

export class FinancialActivityDetector extends EventEmitter {
  private openai: ReturnType<typeof createOllama>;
  private isRunning = false;
  private debugMode: boolean;
  private processingCount = 0;

  constructor(apiKey: string, debugMode = process.env.NODE_ENV === 'development') {
    super();
    this.openai = createOllama();
    this.debugMode = debugMode;
  }

  private log(message: string, ...args: unknown[]) {
    if (this.debugMode) {
      console.log('[FinancialActivityDetector]', message, ...args);
    }
  }

  private containsFinancialKeywords(text: string): string | null {
    this.log('Checking financial keywords in:', text);
    const lowerText = text.toLowerCase();
    for (const [type, keywords] of Object.entries(FINANCIAL_KEYWORDS)) {
      if (keywords.some(keyword => lowerText.includes(keyword))) {
        this.log('Found keyword match:', type);
        return type;
      }
    }
    return null;
  }

  private async processContent(text: string, type: string): Promise<void> {
    this.processingCount++;
    this.emit('processingStateChange', { isProcessing: true, count: this.processingCount });
    
    try {
      this.log('Processing content:', { text, type });
      const keywordMatch = this.containsFinancialKeywords(text);
      if (!keywordMatch) {
        this.log('No keyword match found, skipping');
        return;
      }

      this.log('Generating structured information using LLM');
      const { object: activity } = await generateObject({
        model: ollama('phi4'),
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

      this.log('LLM response:', activity);

      if (activity.confidence > 0.7) {
        this.log('Confidence high enough, storing in database');
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

        await pipe.sendDesktopNotification({
          title: 'New Financial Activity Detected',
          body: `${activity.type}: ${activity.amount} ${activity.currency}`,
          timeout: 5000
        });
        this.log('Notification sent');
        this.emit('activityDetected', activity);
      } else {
        this.log('Confidence too low, skipping storage:', activity.confidence);
      }
    } catch (error) {
      console.error('Error processing financial activity:', error);
      if (this.debugMode) {
        console.error('Full error details:', error);
      }
      this.emit('error', error);
    } finally {
      this.processingCount--;
      this.emit('processingStateChange', { 
        isProcessing: this.processingCount > 0, 
        count: this.processingCount 
      });
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      this.log('Already running, skipping start');
      return;
    }
    
    this.isRunning = true;
    this.emit('stateChange', { isRunning: true });
    this.log('Starting financial activity detector');

    try {
      this.log('Starting vision stream');
      const visionStream = pipe.streamVision(false);
      
      (async () => {
        this.log('Beginning vision stream processing');
        for await (const event of visionStream) {
          if (!this.isRunning) {
            this.log('Stopping vision stream processing');
            break;
          }

          if (this.debugMode) {
            this.log('Raw vision event:', JSON.stringify(event, null, 2));
          }

          const visionEvent = event as VisionEvent;
          if (visionEvent.data.text) {
            this.log('Processing vision event:', {
              text: visionEvent.data.text,
              appName: visionEvent.data.app_name,
              timestamp: visionEvent.data.timestamp
            });

            await this.processContent(
              visionEvent.data.text,
              'ocr'
            );
          } else {
            this.log('Skipping event - no text content');
          }
        }
      })().catch(error => {
        console.error('Vision stream error:', error);
        if (this.debugMode) {
          console.error('Full error details:', error);
        }
        this.emit('error', error);
      });

    } catch (error) {
      console.error('Error starting financial activity detector:', error);
      if (this.debugMode) {
        console.error('Full error details:', error);
      }
      this.emit('error', error);
      this.isRunning = false;
      this.emit('stateChange', { isRunning: false });
    }
  }

  stop(): void {
    this.log('Stopping financial activity detector');
    this.isRunning = false;
    this.emit('stateChange', { isRunning: false });
  }
} 