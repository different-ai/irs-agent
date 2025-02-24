"use client";
import { useState, useEffect } from "react";
import { FinancialActivityDetector } from "@/services/financial-activity-detector";
import { db } from "@/db";
import { financialActivities } from "@/db/schema";
import { desc } from "drizzle-orm";
import { useApiKey } from "@/hooks/use-api-key";
import { Toaster } from "@/components/ui/toaster";

interface FinancialActivity {
  id: number;
  timestamp: Date;
  type: string;
  amount: string;
  currency: string;
  description: string;
  senderName: string | null;
  receiverName: string | null;
  confidence: string;
  sourceText: string;
  sourceType: string;
}

const AgentView = () => {
  const [search, setSearch] = useState("");
  const [activities, setActivities] = useState<FinancialActivity[]>([]);
  const [isDetectorRunning, setIsDetectorRunning] = useState(false);
  const [detector, setDetector] = useState<FinancialActivityDetector | null>(null);
  const apiKey = useApiKey();

  useEffect(() => {
    if (apiKey) {
      // Initialize detector only if API key is available
      const newDetector = new FinancialActivityDetector(apiKey, true);
      setDetector(newDetector);
    }

    // Load initial activities
    loadActivities();

    return () => {
      if (detector) {
        detector.stop();
      }
    };
  }, [apiKey]); // Re-run when API key changes

  const loadActivities = async () => {
    const results = await db
      .select()
      .from(financialActivities)
      .orderBy(desc(financialActivities.timestamp))
      .limit(50);
    setActivities(results);
  };

  const toggleDetector = async () => {
    if (!detector) return;

    if (isDetectorRunning) {
      detector.stop();
    } else {
      await detector.start();
    }
    setIsDetectorRunning(!isDetectorRunning);
  };

  const filterActivities = () => {
    if (!search) return activities;
    
    return activities.filter(activity => 
      activity.description.toLowerCase().includes(search.toLowerCase()) ||
      activity.type.toLowerCase().includes(search.toLowerCase()) ||
      activity.sourceText.toLowerCase().includes(search.toLowerCase())
    );
  };

  return (
    <>
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold">Financial Activity Monitor</h2>
          <button
            onClick={toggleDetector}
            disabled={!apiKey}
            className={`px-4 py-2 rounded-md ${
              !apiKey 
                ? "bg-gray-400 cursor-not-allowed"
                : isDetectorRunning
                ? "bg-red-500 hover:bg-red-600"
                : "bg-green-500 hover:bg-green-600"
            } text-white`}
          >
            {!apiKey 
              ? "API Key Required"
              : isDetectorRunning 
              ? "Stop Detector" 
              : "Start Detector"}
          </button>
        </div>

        <div className="mb-6">
          <input
            type="text"
            placeholder="Search activities..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2 border rounded-md"
          />
        </div>

        <div className="space-y-4">
          {filterActivities().map((activity) => (
            <div
              key={activity.id}
              className="border rounded-lg p-4 hover:bg-gray-50"
            >
              <div className="flex justify-between items-start">
                <div>
                  <span className="inline-block px-2 py-1 text-sm rounded-full bg-blue-100 text-blue-800">
                    {activity.type}
                  </span>
                  <p className="mt-2 text-lg font-medium">
                    {activity.amount} {activity.currency}
                  </p>
                  <p className="text-gray-600">{activity.description}</p>
                  {(activity.senderName || activity.receiverName) && (
                    <p className="text-sm text-gray-500 mt-1">
                      {activity.senderName && `From: ${activity.senderName}`}
                      {activity.senderName && activity.receiverName && " • "}
                      {activity.receiverName && `To: ${activity.receiverName}`}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">
                    {new Date(activity.timestamp).toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-400">
                    Confidence: {Math.round(parseFloat(activity.confidence) * 100)}%
                  </p>
                </div>
              </div>
              <p className="mt-2 text-sm text-gray-500">
                Source: {activity.sourceType}
              </p>
              <p className="mt-1 text-xs text-gray-400 break-words">
                {activity.sourceText}
              </p>
            </div>
          ))}
          {filterActivities().length === 0 && (
            <p className="text-center text-gray-500 py-8">
              No financial activities found
            </p>
          )}
        </div>
      </div>
      <Toaster />
    </>
  );
};

export default AgentView;
