import { useEffect, useState } from 'react';
import { useToast } from "@/components/ui/use-toast";

export function useApiKey() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const key = process.env.OPENAI_API_KEY;
    setApiKey(key || null);

    if (!key) {
      toast({
        variant: "destructive",
        title: "API Key Missing",
        description: "OpenAI API key is not set. Some features may not work properly.",
      });
    }
  }, [toast]);

  return apiKey;
} 