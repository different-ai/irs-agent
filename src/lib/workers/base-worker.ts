"use client";

import { createOpenAI } from '@ai-sdk/openai';
import type { z } from 'zod';

export interface WorkerContext {
  apiKey: string;
  classificationId: string;
  query: string;
  timeframe: {
    startTime: string;
    endTime: string;
    type: 'specific' | 'relative' | 'none';
  };
}

export abstract class BaseWorker<TInput, TOutput> {
  protected openai!: ReturnType<typeof createOpenAI>;

  constructor() {
    this.openai = createOpenAI({ apiKey: '' });
  }

  protected initializeApi(apiKey: string) {
    this.openai = createOpenAI({ apiKey });
  }

  abstract execute(input: TInput, context: WorkerContext): Promise<TOutput>;
} 