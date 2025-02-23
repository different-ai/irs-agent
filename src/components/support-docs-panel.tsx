'use client';

import React from 'react';
import { useEffect, useState } from 'react';
import { db } from '@/db';
import { supportDocs } from '@/db/schema';
import { desc } from 'drizzle-orm';
import * as Accordion from '@radix-ui/react-accordion';
import { ChevronDown } from 'lucide-react';

interface SupportDoc {
  id: number;
  timestamp: Date;
  summary: string;
  keyPoints: string[];
  recommendedActions: string[];
  timeframe: {
    startTime: string;
    endTime: string;
    rawDescription: string;
  };
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
  contentInner: `
    py-2 px-1
  `,
};

export function SupportDocsPanel() {
  const [docs, setDocs] = useState<SupportDoc[]>([]);

  useEffect(() => {
    async function loadDocs() {
      const items = await db
        .select()
        .from(supportDocs)
        .orderBy(desc(supportDocs.timestamp))
        .limit(50);

      setDocs(items.map(item => ({
        id: item.id,
        timestamp: item.timestamp,
        summary: item.summary,
        keyPoints: item.keyPoints as string[],
        recommendedActions: item.recommendedActions as string[],
        timeframe: item.timeframe as {
          startTime: string;
          endTime: string;
          rawDescription: string;
        },
      })));
    }

    loadDocs();
  }, []);

  return (
    <div className="bg-white shadow overflow-hidden rounded-lg">
      <div className="px-4 py-5 sm:px-6">
        <h3 className="text-lg font-medium text-gray-900">Support Documentation</h3>
      </div>
      <ul className="divide-y divide-gray-200">
        {docs.map((doc) => (
          <li key={doc.id} className="px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h4 className="text-sm font-medium text-gray-900">{doc.summary}</h4>
                <p className="text-xs text-gray-500 mt-1">
                  {new Date(doc.timestamp).toLocaleString()}
                </p>
                <p className="text-xs text-gray-500">
                  Time range: {doc.timeframe.rawDescription}
                </p>
              </div>
            </div>

            <Accordion.Root type="single" collapsible>
              <Accordion.Item value="details">
                <Accordion.Trigger className={accordionStyles.trigger}>
                  <ChevronDown className={accordionStyles.chevron} />
                  <span>View Details</span>
                </Accordion.Trigger>
                <Accordion.Content className={accordionStyles.content}>
                  <div className={accordionStyles.contentInner}>
                    <div className="space-y-4">
                      <div>
                        <h5 className="font-medium text-gray-700">Key Points</h5>
                        <ul className="mt-1 list-disc list-inside">
                          {doc.keyPoints.map((point, idx) => (
                            <li key={idx} className="text-gray-600">{point}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h5 className="font-medium text-gray-700">Recommended Actions</h5>
                        <ul className="mt-1 list-disc list-inside">
                          {doc.recommendedActions.map((action, idx) => (
                            <li key={idx} className="text-gray-600">{action}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </Accordion.Content>
              </Accordion.Item>
            </Accordion.Root>
          </li>
        ))}
        {docs.length === 0 && (
          <li className="px-4 py-4 text-gray-500">
            No support documentation available yet
          </li>
        )}
      </ul>
    </div>
  );
} 