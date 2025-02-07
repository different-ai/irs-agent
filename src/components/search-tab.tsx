"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { AgentStepsView } from "@/components/agent-steps-view";
import { interpretSearch } from "@/app/action";
import { orchestrateClassification } from "@/app/orchestrate-classification";
import { useSettings } from "@/hooks/use-settings";

export function SearchTab() {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResult, setSearchResult] = useState<string>("");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [classificationId, setClassificationId] = useState<string | null>(null);

  const { settings } = useSettings();
  // Search handlers
  const handleSimpleSearch = async () => {
    if (!searchTerm.trim()) return;
    
    try {
      setIsSearching(true);
      setSearchError(null);
      const result = await interpretSearch(searchTerm, classificationId || '');
      setSearchResult(result);
    } catch (err) {
      console.error("Search error:", err);
      setSearchError((err as Error).message);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAdvancedSearch = async () => {
    try {
      const newId = crypto.randomUUID();
      setClassificationId(newId);
      
      const { results } = await orchestrateClassification(
        searchTerm,
        undefined,
        settings.openaiApiKey,
        newId
      );
      
      // The final answer is in the last result
      const finalAnswer = results[results.length - 1]?.answer;
      setSearchResult(finalAnswer || 'No results found');
    } catch (err) {
      console.error("Advanced search error:", err);
      setSearchError((err as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Search captured items:
        </label>
        <div className="mt-1 flex gap-2">
          <input
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Enter search query..."
          />
          <Button onClick={handleSimpleSearch} disabled={isSearching}>
            {isSearching ? "Searching..." : "Search"}
          </Button>
          <Button variant="outline" onClick={handleAdvancedSearch}>
            Advanced Search
          </Button>
        </div>
      </div>

      {searchError && (
        <div className="p-4 bg-red-50 text-red-700 rounded-md">
          {searchError}
        </div>
      )}

      {searchResult && (
        <div className="p-4 bg-green-50 text-green-800 rounded-md">
          <h4 className="font-medium mb-2">Search Results:</h4>
          <div className="whitespace-pre-line">{searchResult}</div>
        </div>
      )}

      {classificationId && (
        <div className="mt-8">
          <h4 className="text-lg font-medium mb-4">Analysis Steps</h4>
          <AgentStepsView 
            recognizedItemId={classificationId}
            className="bg-white rounded-lg shadow"
          />
        </div>
      )}
    </div>
  );
} 