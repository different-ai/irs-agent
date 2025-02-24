'use client';

import React, { useEffect, useState } from 'react';
import { db } from '@/db';
import { financialActivities } from '@/db/schema';
import { desc } from 'drizzle-orm';
import * as Accordion from '@radix-ui/react-accordion';
import { ChevronDown, DollarSign, Loader2 } from 'lucide-react';
import { FinancialActivityDetector } from '@/services/financial-activity-detector';
import { useSettings } from '@/hooks/use-settings';
import { useToast } from '@/components/ui/use-toast';

interface FinancialActivity {
  id: number;
  timestamp: Date;
  type: string;
  amount: string; // Changed to string since it's numeric in DB
  currency: string;
  description: string;
  senderName: string | null;
  receiverName: string | null;
  confidence: string; // Changed to string since it's numeric in DB
  sourceText: string;
  sourceType: string;
}

const accordionStyles = {
  trigger: `
    group flex w-full items-center gap-2 text-sm text-gray-500 
    hover:text-gray-700 mt-2 cursor-pointer transition-colors
  `,
  content: `
    overflow-hidden text-sm text-gray-600
    data-[state=open]:animate-accordion-down 
    data-[state=closed]:animate-accordion-up
  `,
  chevron: `
    w-4 h-4 shrink-0 text-gray-500
    transition-transform duration-200
    group-data-[state=open]:rotate-180
  `,
};

export function FinancialActivityTab() {
  const [activities, setActivities] = useState<FinancialActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [detector, setDetector] = useState<FinancialActivityDetector | null>(null);
  const [isDetectorRunning, setIsDetectorRunning] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingCount, setProcessingCount] = useState(0);
  const settings = useSettings();
  const { toast } = useToast();

  const loadActivities = async () => {
    const items = await db
      .select()
      .from(financialActivities)
      .orderBy(desc(financialActivities.timestamp))
      .limit(50);

    setActivities(items);
    setIsLoading(false);
  };

  useEffect(() => {
    const apiKey = settings.settings.openaiApiKey || process.env.NEXT_PUBLIC_OPENAI_API_KEY;

    if (!apiKey) {
      toast({
        variant: "destructive",
        title: "API Key Missing",
        description: "OpenAI API key is not set. Financial activity detection will not work.",
      });
      return;
    }

    if (!detector) {
      const newDetector = new FinancialActivityDetector(apiKey);
      
      // Set up event listeners
      newDetector.on('stateChange', ({ isRunning }) => {
        setIsDetectorRunning(isRunning);
        if (isRunning) {
          toast({
            title: "Detector Started",
            description: "Now monitoring for financial activities...",
          });
        }
      });

      newDetector.on('processingStateChange', ({ isProcessing, count }) => {
        setIsProcessing(isProcessing);
        setProcessingCount(count);
      });

      newDetector.on('activityDetected', (activity) => {
        toast({
          title: "New Activity Detected",
          description: `${activity.type}: ${activity.amount} ${activity.currency}`,
        });
        loadActivities();
      });

      newDetector.on('error', (error) => {
        toast({
          variant: "destructive",
          title: "Detection Error",
          description: "An error occurred while processing financial activities.",
        });
        console.error('Detector error:', error);
      });

      setDetector(newDetector);
      newDetector.start().catch(console.error);
    }

    return () => {
      detector?.stop();
      detector?.removeAllListeners();
    };
  }, [detector, settings.settings.openaiApiKey, toast]);

  useEffect(() => {
    loadActivities();
    const intervalId = setInterval(loadActivities, 5000);
    return () => clearInterval(intervalId);
  }, []);

  const getTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'invoice': return 'bg-blue-100 text-blue-800';
      case 'payment': return 'bg-green-100 text-green-800';
      case 'receipt': return 'bg-purple-100 text-purple-800';
      case 'subscription': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return <div className="p-4">Loading financial activities...</div>;
  }

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-4 py-5 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Financial Activities</h3>
            <p className="mt-1 text-sm text-gray-500">
              Automatically tracked financial events from your conversations
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isProcessing && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Processing {processingCount} items...</span>
              </div>
            )}
            <button
              onClick={() => detector?.[isDetectorRunning ? 'stop' : 'start']()}
              disabled={!detector}
              className={`px-4 py-2 rounded-md ${
                !detector 
                  ? "bg-gray-400 cursor-not-allowed"
                  : isDetectorRunning
                  ? "bg-red-500 hover:bg-red-600"
                  : "bg-green-500 hover:bg-green-600"
              } text-white`}
            >
              {!detector 
                ? "API Key Required"
                : isDetectorRunning 
                ? "Stop Detector" 
                : "Start Detector"}
            </button>
          </div>
        </div>
      </div>

      <div className="divide-y divide-gray-200">
        {activities.map((activity) => (
          <div key={activity.id} className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <DollarSign className="h-5 w-5 text-gray-400" />
                <div>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeColor(activity.type)}`}>
                    {activity.type}
                  </span>
                  <p className="mt-1 text-sm font-medium text-gray-900">
                    {activity.amount} {activity.currency}
                  </p>
                </div>
              </div>
              <span className="text-xs text-gray-500">
                {new Date(activity.timestamp).toLocaleString()}
              </span>
            </div>

            <p className="mt-2 text-sm text-gray-600">{activity.description}</p>

            <Accordion.Root type="single" collapsible>
              <Accordion.Item value="details">
                <Accordion.Trigger className={accordionStyles.trigger}>
                  <ChevronDown className={accordionStyles.chevron} />
                  <span>View Details</span>
                </Accordion.Trigger>
                <Accordion.Content className={accordionStyles.content}>
                  <div className="mt-3 space-y-2 text-sm">
                    {activity.senderName && (
                      <p>From: {activity.senderName}</p>
                    )}
                    {activity.receiverName && (
                      <p>To: {activity.receiverName}</p>
                    )}
                    <p>Confidence: {(parseFloat(activity.confidence) * 100).toFixed(1)}%</p>
                    <p>Source: {activity.sourceType}</p>
                    <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                      <p className="font-medium text-gray-700">Original Text:</p>
                      <p className="mt-1 text-gray-600">{activity.sourceText}</p>
                    </div>
                  </div>
                </Accordion.Content>
              </Accordion.Item>
            </Accordion.Root>
          </div>
        ))}

        {activities.length === 0 && (
          <div className="p-4 text-center text-gray-500">
            No financial activities detected yet. The system will automatically track mentions of invoices, payments, receipts, and subscriptions.
          </div>
        )}
      </div>
    </div>
  );
} 