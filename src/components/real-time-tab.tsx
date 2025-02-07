"use client";

import React, { useEffect, useState, useCallback } from "react";
import { pipe } from "@screenpipe/browser";
import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import type { InboxItem } from "@/types/inbox";
import { z } from "zod";
import { useSettings } from "@/hooks/use-settings";
import { db } from "@/db";
import { classifiedItems } from "@/db/schema";
import Image from "next/image";
import { desc } from "drizzle-orm";
import * as Accordion from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";

interface ClassifiedContent {
  isImportant: boolean;
  type: "invoice" | "conversation" | "task" | "other";
  confidence: number;
  summary: string;
  details?: {
    amount?: string;
    description?: string;
    participants?: string[];
    dueDate?: string;
  };
}

interface ClassifiedInboxItem extends InboxItem {
  classification: ClassifiedContent;
  hyperInfo?: string;
}

// Add interface for transcription chunk
interface TranscriptionChunk {
  choices: Array<{ text: string }>;
  metadata?: {
    timestamp: string;
    device: string;
    isInput: boolean;
  };
}

// Add interface for audio items
interface AudioTranscription {
  text: string;
  timestamp: string;
  device: string;
  isInput: boolean;
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

const generateHyperInfo = (
  text: string,
  classification: ClassifiedContent
): string => {
  const details = classification.details || {};

  switch (classification.type) {
    case "invoice":
      return `Invoice ${details.amount || ""} for ${
        details.description || ""
      } ${details.dueDate || ""}`.trim();

    case "conversation":
      return `Conversation with ${
        details.participants?.join(", ") || ""
      } about ${classification.summary}`.trim();

    case "task":
      return `Task: ${classification.summary} ${
        details.dueDate ? `due ${details.dueDate}` : ""
      }`.trim();

    default:
      return `${classification.type}: ${classification.summary}`.trim();
  }
};

const checkForDuplicates = async (
  hyperInfo: string,
  openai: ReturnType<typeof createOpenAI>
) => {
  try {
    // Get all items with hyperInfo
    const items = await db
      .select({
        text: classifiedItems.text,
        hyperInfo: classifiedItems.hyperInfo,
        classification: classifiedItems.classification,
      })
      .from(classifiedItems)
      .orderBy(desc(classifiedItems.timestamp))
      .limit(10); // Only check against the 10 most recent items for efficiency

    console.log("Checking for duplicates with hyperInfo:", hyperInfo);

    // Check each item with GPT-4 Mini
    for (const item of items) {
      if (!item.hyperInfo) continue;

      const { object: comparison } = await generateObject({
        model: openai("gpt-4o-mini"),
        schema: z.object({
          isDuplicate: z.boolean(),
          explanation: z.string(),
          similarityScore: z.number().min(0).max(1),
        }),
        prompt: `Compare these two pieces of information and determine if they refer to the same thing:

Item 1: "${hyperInfo}"
Item 2: "${item.hyperInfo}"

Consider:
1. Are they about the same event/task/invoice/conversation?
2. Do they have matching key details (amounts, dates, participants)?
3. Could these reasonably be considered duplicates?

Respond with:
1. isDuplicate: true if they are effectively the same, false otherwise
2. explanation: brief reason for your decision
3. similarityScore: number between 0-1 indicating similarity (1 = identical, 0 = completely different)`,
      });

      console.log("Comparison result:", {
        current: hyperInfo,
        existing: item.hyperInfo,
        ...comparison,
      });

      if (comparison.isDuplicate) {
        console.log(
          "Found duplicate:",
          item.hyperInfo,
          "with similarity:",
          comparison.similarityScore
        );
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error("Error checking for duplicates:", error);
    return false; // In case of error, assume no duplicate to avoid blocking content
  }
};

export function RealTimeTab() {
  // Update state to use array of keywords
  const [error, setError] = useState<string | null>(null);
  const [inboxItems, setInboxItems] = useState<ClassifiedInboxItem[]>([]);
  const [watchKeywords, setWatchKeywords] = useState<string[]>(["invoice"]);
  const [newKeyword, setNewKeyword] = useState("");
  const [streamingEnabled, setStreamingEnabled] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [visionPassthrough, setVisionPassthrough] = useState(false);
  const [audioPassthrough, setAudioPassthrough] = useState(false);
  const [audioItems, setAudioItems] = useState<AudioTranscription[]>([]);

  // Add keyword management functions
  const addKeyword = () => {
    if (newKeyword.trim() && !watchKeywords.includes(newKeyword.trim())) {
      setWatchKeywords(prev => [...prev, newKeyword.trim()]);
      setNewKeyword("");
    }
  };

  const removeKeyword = (keyword: string) => {
    setWatchKeywords(prev => prev.filter(k => k !== keyword));
  };

  // Helper function to check if text matches any keyword
  const matchesAnyKeyword = (text: string): boolean => {
    return watchKeywords.some(keyword => 
      text.toLowerCase().includes(keyword.toLowerCase())
    );
  };

  // get settings from screenpipe
  const settings = useSettings();
  console.log("settings", settings);
  const openai = createOpenAI({ apiKey: settings.settings.openaiApiKey });

  const classifyContent = useCallback(
    async (
      text: string,
      appName: string,
      windowName: string
    ): Promise<ClassifiedContent | null> => {
      try {
        const { object: classification } = await generateObject({
          model: openai("o3-mini"),
          schema: z.object({
            isImportant: z.boolean(),
            type: z.enum(["invoice", "conversation", "task", "other"]),
            confidence: z.number(),
            summary: z.string(),
            details: z.object({
              amount: z.string(),
              description: z.string(),
              participants: z.array(z.string()),
              dueDate: z.string(),
            }),
          }),
          prompt: `Analyze this content with its context:
        Text: "${text}"
        Application: ${appName}
        Window: ${windowName}
        
        Consider:
        1. Is this important information? (meetings, tasks, invoices)
        2. What type of content is it?
        3. Does the app/window context make sense for this type?
           - Invoices are unlikely in development environments
           - Tasks in VS Code are likely code-related
           - Conversations in Zoom/Teams are likely meetings
        4. What are the key details?
        
        Only mark as important if:
        - Content is significant
        - Context matches content type
        - App/window makes sense for the classification`,
        });

        return classification;
      } catch (err) {
        console.error("Classification error:", err);
        return null;
      }
    },
    [openai]
  );

  // Update vision stream effect to use multiple keywords
  useEffect(() => {
    if (!streamingEnabled) return;

    let isSubscribed = true;
    console.log("Effect started, setting up stream...");
    setStatusMessage("Starting vision stream...");

    (async () => {
      try {
        const stream = pipe.streamVision(true);

        for await (const event of stream) {
          if (!isSubscribed) break;

          const text = event.data?.text;

          if (!text) continue;

          // Skip keyword check if passthrough is enabled
          if (!visionPassthrough && !matchesAnyKeyword(text)) {
            continue;
          }

          setStatusMessage(`Processing content...`);

          // First classify the content
          const classification = await classifyContent(
            text,
            event.data.app_name || "Unknown",
            event.data.window_name || "Unknown"
          );

          if (!classification) {
            setStatusMessage("Classification failed - skipping");
            continue;
          }

          // Generate hyperInfo from classification
          const hyperInfo = generateHyperInfo(text, classification);
          console.log("Generated hyperInfo:", hyperInfo);

          // Check for duplicates using GPT-4 Mini
          const isDuplicate = await checkForDuplicates(hyperInfo, openai);

          if (isDuplicate) {
            setStatusMessage("Skipping duplicate content");
            continue;
          }

          setStatusMessage(`Content is unique - Analyzing...`);

          // In passthrough mode, save all items regardless of importance
          if (
            visionPassthrough ||
            (classification.confidence > 0.8 && classification.isImportant)
          ) {
            setStatusMessage("Saving content to database...");

            try {
              const dbItem = {
                text,
                appName: event.data.app_name || "Unknown",
                windowName: event.data.window_name || "Unknown",
                timestamp: new Date(),
                type: "vision",
                image: event.data.image || null,
                classification: classification,
                isImportant: visionPassthrough
                  ? true
                  : classification.isImportant,
                confidence: String(classification.confidence),
                hyperInfo,
              };

              // Insert into DB
              await db.insert(classifiedItems).values([dbItem]);

              // Create UI item
              const uiItem = {
                text,
                appName: event.data.app_name || "Unknown",
                windowName: event.data.window_name || "Unknown",
                timestamp: dbItem.timestamp.toISOString(),
                type: "vision",
                image: event.data.image || null,
                classification: classification,
                isImportant: visionPassthrough
                  ? true
                  : classification.isImportant,
                confidence: String(classification.confidence),
                hyperInfo,
              } as ClassifiedInboxItem;

              setInboxItems((prev) => [...prev, uiItem]);
              setStatusMessage("Item saved successfully");
            } catch (error) {
              console.error("Error saving to database:", error);
              setError(`Failed to save item: ${(error as Error).message}`);
            }
          } else {
            setStatusMessage("Content not important enough - skipping");
          }

          // Clear status after a delay
          setTimeout(() => {
            if (isSubscribed) setStatusMessage("");
          }, 2000);
        }
      } catch (err) {
        console.error("Vision stream error:", err);
        if (isSubscribed) {
          setError("Vision stream error: " + (err as Error).message);
          setStatusMessage("");
        }
      }
    })();

    return () => {
      isSubscribed = false;
      setStatusMessage("");
    };
  }, [watchKeywords, streamingEnabled, classifyContent, openai, visionPassthrough]);

  // Load items from DB on mount
  useEffect(() => {
    async function loadItems() {
      const items = await db
        .select()
        .from(classifiedItems)
        .orderBy(classifiedItems.timestamp)
        .limit(50);

      // Convert DB items to UI items
      const uiItems = items.map((item) => {
        // Parse the classification if it's a string, otherwise use as is
        const classification =
          typeof item.classification === "string"
            ? JSON.parse(item.classification)
            : item.classification;

        return {
          text: item.text,
          appName: item.appName || "Unknown",
          windowName: item.windowName || "Unknown",
          timestamp: item.timestamp.toISOString(),
          type: "vision",
          image: item.image || null,
          classification: classification as ClassifiedContent,
          isImportant: item.isImportant,
          confidence: item.confidence,
          hyperInfo: item.hyperInfo,
        } as ClassifiedInboxItem;
      });

      setInboxItems(uiItems);
    }
    loadItems();
  }, []);

  // Update audio stream effect to use multiple keywords
  useEffect(() => {
    console.log("watchKeywords", watchKeywords);
    console.log("audioPassthrough", audioPassthrough);
    if (!streamingEnabled) return;

    let isSubscribed = true;
    console.log("Starting audio transcription stream...");

    (async () => {
      try {
        for await (const chunk of pipe.streamTranscriptions() as AsyncIterable<TranscriptionChunk>) {
          console.log("chunk", chunk);
          if (!isSubscribed) break;

          if (!chunk.metadata) {
            console.warn("Received chunk without metadata:", chunk);
            continue;
          }

          // Skip if not in passthrough mode and doesn't contain any keyword
          if (!audioPassthrough && !matchesAnyKeyword(chunk.choices[0].text)) {
            continue;
          }

          const transcription: AudioTranscription = {
            text: chunk.choices[0].text,
            timestamp: chunk.metadata.timestamp,
            device: chunk.metadata.device,
            isInput: chunk.metadata.isInput,
          };

          setAudioItems((prev) => [...prev, transcription]);
        }
      } catch (err) {
        console.error("Audio stream error:", err);
        if (isSubscribed) {
          setError("Audio stream error: " + (err as Error).message);
        }
      }
    })();

    return () => {
      isSubscribed = false;
    };
  }, [streamingEnabled, audioPassthrough, watchKeywords, matchesAnyKeyword]);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col gap-4">
        {/* Main Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={streamingEnabled}
                onChange={(e) => setStreamingEnabled(e.target.checked)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              Enable real-time streaming
            </label>

            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={visionPassthrough}
                onChange={(e) => setVisionPassthrough(e.target.checked)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              Vision Passthrough
            </label>

            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={audioPassthrough}
                onChange={(e) => setAudioPassthrough(e.target.checked)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              Audio Passthrough
            </label>
          </div>
        </div>

        {/* Keywords Section */}
        {streamingEnabled && !visionPassthrough && !audioPassthrough && (
          <div className="flex flex-col gap-2">
            <label className="block text-sm font-medium text-gray-700">
              Watch keywords:
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {watchKeywords.map((keyword) => (
                <span
                  key={keyword}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm bg-indigo-100 text-indigo-700"
                >
                  {keyword}
                  <button
                    onClick={() => removeKeyword(keyword)}
                    className="hover:text-indigo-900"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                type="text"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && addKeyword()}
                placeholder="Add new keyword..."
              />
              <button
                onClick={addKeyword}
                className="px-3 py-1 rounded-md bg-indigo-600 text-white text-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                Add
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Status and Error Messages */}
      {statusMessage && (
        <div className="p-2 bg-yellow-100 text-yellow-700 rounded-md">
          {statusMessage}
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-md">{error}</div>
      )}

      {/* Content Grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Vision Stream */}
        <div className="bg-white shadow overflow-hidden rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg font-medium text-gray-900">Vision Stream</h3>
          </div>
          <ul className="divide-y divide-gray-200">
            {inboxItems.map((item, idx) => (
              <li key={idx} className="px-4 py-4">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      item.classification.type === "invoice"
                        ? "bg-green-100 text-green-800"
                        : item.classification.type === "conversation"
                        ? "bg-blue-100 text-blue-800"
                        : item.classification.type === "task"
                        ? "bg-purple-100 text-purple-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {item.classification.type}
                  </span>
                  <div className="text-sm font-medium text-gray-900">
                    {item.classification.summary}
                  </div>
                </div>

                <Accordion.Root type="single" collapsible>
                  <Accordion.Item value="content">
                    <Accordion.Trigger className={accordionStyles.trigger}>
                      <ChevronDown className={accordionStyles.chevron} />
                      <span>View Raw Content</span>
                    </Accordion.Trigger>
                    <Accordion.Content className={accordionStyles.content}>
                      <div className={accordionStyles.contentInner}>
                        {item.text}
                      </div>
                    </Accordion.Content>
                  </Accordion.Item>
                </Accordion.Root>

                {item.image && (
                  <Image
                    src={`data:image/jpeg;base64,${item.image}`}
                    alt="Screenshot"
                    className="mt-2 max-w-sm rounded-lg shadow-sm"
                    width={800}
                    height={600}
                    unoptimized
                  />
                )}

                {item.hyperInfo && (
                  <div className="mt-1 text-xs text-gray-500 italic">
                    {item.hyperInfo}
                  </div>
                )}

                {item.classification.details && (
                  <div className="mt-1 text-xs text-gray-600 space-y-1">
                    {Object.entries(item.classification.details).map(
                      ([key, value]) => (
                        <div key={key} className="flex gap-2">
                          <span className="font-medium">{key}:</span>
                          <span>{value}</span>
                        </div>
                      )
                    )}
                  </div>
                )}

                <div className="text-xs text-gray-500 mt-2 flex items-center gap-2">
                  <span>{item.appName}</span>
                  <span>•</span>
                  <span>{new Date(item.timestamp).toLocaleString()}</span>
                  <span>•</span>
                  <span>
                    Confidence:{" "}
                    {Math.round(item.classification.confidence * 100)}%
                  </span>
                </div>
              </li>
            ))}
            {inboxItems.length === 0 && (
              <li className="px-4 py-4 text-gray-500">
                {streamingEnabled
                  ? "Waiting for vision items..."
                  : "Enable streaming to see items"}
              </li>
            )}
          </ul>
        </div>

        {/* Audio Stream */}
        <div className="bg-white shadow overflow-hidden rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg font-medium text-gray-900">Audio Stream</h3>
          </div>
          <ul className="divide-y divide-gray-200">
            {audioItems.map((item, idx) => (
              <li key={idx} className="px-4 py-4">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      item.isInput
                        ? "bg-blue-100 text-blue-800"
                        : "bg-green-100 text-green-800"
                    }`}
                  >
                    {item.isInput ? "Input" : "Output"}
                  </span>
                  <div className="text-sm text-gray-900">{item.text}</div>
                </div>
                <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                  <span>{item.device}</span>
                  <span>•</span>
                  <span>{new Date(item.timestamp).toLocaleString()}</span>
                </div>
              </li>
            ))}
            {audioItems.length === 0 && (
              <li className="px-4 py-4 text-gray-500">
                {streamingEnabled
                  ? "Waiting for audio transcriptions..."
                  : "Enable streaming to see transcriptions"}
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
