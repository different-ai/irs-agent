"use client";

import React, { useEffect, useState } from "react";
import { pipe } from '@screenpipe/browser';

interface StreamMessage {
  text: string;
  timestamp: string;
  appName?: string;
  windowName?: string;
}

const normalizeText = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .trim();
};

const containsKeywordsInOrder = (text: string, keywords: string): boolean => {
  const normalizedText = normalizeText(text);
  const keywordParts = normalizeText(keywords).split(/\s+/);
  
  let currentIndex = 0;
  for (const part of keywordParts) {
    const nextIndex = normalizedText.indexOf(part, currentIndex);
    if (nextIndex === -1) return false;
    currentIndex = nextIndex + part.length;
  }
  return true;
};

export function RealTimeTab() {
  const [error, setError] = useState<string | null>(null);
  const [filterKeyword, setFilterKeyword] = useState<string>("");
  const [streamingEnabled, setStreamingEnabled] = useState(false);
  const [messages, setMessages] = useState<StreamMessage[]>([]);

  // Update stream effect using Screenpipe
  useEffect(() => {
    if (!streamingEnabled) return;

    let isSubscribed = true;
    
    (async () => {
      try {
        // Stream vision events, false to exclude images for better performance
        for await (const event of pipe.streamVision(false)) {
          if (!isSubscribed) break;

          const message: StreamMessage = {
            text: event.data.text || '',
            timestamp: new Date().toISOString(),
            appName: event.data.app_name,
            windowName: event.data.window_name,
          };

          // Only add messages that match the keyword if one is set
          if (!filterKeyword || containsKeywordsInOrder(message.text, filterKeyword)) {
            setMessages((prev) => [...prev, message]);
          }
        }
      } catch (err) {
        console.error("Vision stream error:", err);
        if (isSubscribed) {
          setError("Stream connection error. Please try reconnecting.");
        }
      }
    })();

    return () => {
      isSubscribed = false;
    };
  }, [streamingEnabled, filterKeyword]);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={streamingEnabled}
                onChange={(e) => setStreamingEnabled(e.target.checked)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              Enable streaming
            </label>
          </div>
        </div>

        {/* Keyword Filter Input */}
        {streamingEnabled && (
          <div className="flex flex-col gap-2">
            <label className="block text-sm font-medium text-gray-700">
              Filter keyword:
            </label>
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                type="text"
                value={filterKeyword}
                onChange={(e) => setFilterKeyword(e.target.value)}
                placeholder="Enter keyword to filter messages..."
              />
            </div>
            {filterKeyword && (
              <p className="text-xs text-gray-500">
                Showing messages containing: &ldquo;{filterKeyword}&rdquo;
              </p>
            )}
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-md mb-4">
          {error}
        </div>
      )}

      {/* Messages Panel */}
      <div className="bg-white shadow overflow-hidden rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg font-medium text-gray-900">
            Stream Messages
          </h3>
        </div>
        <ul className="divide-y divide-gray-200">
          {messages.map((message, idx) => (
            <li key={idx} className="px-4 py-4">
              <div className="text-sm text-gray-900">{message.text}</div>
              {(message.appName || message.windowName) && (
                <div className="flex gap-2 mt-1">
                  {message.appName && (
                    <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                      {message.appName}
                    </span>
                  )}
                  {message.windowName && (
                    <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">
                      {message.windowName}
                    </span>
                  )}
                </div>
              )}
              <div className="text-xs text-gray-500 mt-1">
                {new Date(message.timestamp).toLocaleString()}
              </div>
            </li>
          ))}
          {messages.length === 0 && (
            <li className="px-4 py-4 text-gray-500">
              {streamingEnabled
                ? filterKeyword
                  ? "Waiting for messages matching your filter..."
                  : "Waiting for messages..."
                : "Enable streaming to see messages"}
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
