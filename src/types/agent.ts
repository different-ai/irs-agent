export interface AgentStep {
  id: string;
  timestamp: string;
  humanAction?: string | { command: string; args: any[] };
  humanResult?: string;
  text?: string;
  toolCalls?: Array<{
    toolName?: string;
    arguments?: any;
  }>;
  toolResults?: any[];
  usage?: {
    totalTokens: number;
  };
  finishReason?: 'stop' | 'error' | null;
} 