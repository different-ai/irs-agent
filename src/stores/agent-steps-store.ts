import { create } from 'zustand';

export interface AgentStep {
  id: string;
  timestamp: number;
  humanAction?: string;
  humanResult?: string;
  text?: string;
  toolCalls?: Array<{
    toolName?: string;
    [key: string]: any;
  }>;
  toolResults?: any[];
  usage?: {
    totalTokens: number;
  };
  finishReason?: 'complete' | 'error' | null;
}

interface AgentStepsState {
  steps: Record<string, AgentStep[]>;
  addStep: (recognizedItemId: string, step: Partial<AgentStep>) => void;
  clearSteps: (recognizedItemId: string) => void;
}

export const useAgentStepsStore = create<AgentStepsState>((set) => ({
  steps: {},
  addStep: (recognizedItemId, step) =>
    set((state) => ({
      steps: {
        ...state.steps,
        [recognizedItemId]: [
          ...(state.steps[recognizedItemId] || []),
          {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            ...step,
          },
        ],
      },
    })),
  clearSteps: (recognizedItemId) =>
    set((state) => ({
      steps: {
        ...state.steps,
        [recognizedItemId]: [],
      },
    })),
})); 