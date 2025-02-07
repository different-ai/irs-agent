"use client";

import React, { useState, useEffect } from "react";
import { useSettings } from "@/hooks/use-settings";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export function SettingsTab() {
  const { settings, loading, error, updateSetting } = useSettings();
  const [promptValue, setPromptValue] = useState("");

  useEffect(() => {
    const existingPrompt = settings?.customSettings?.obsidian?.prompt || "";
    setPromptValue(existingPrompt);
  }, [settings]);

  const handleSave = async () => {
    try {
      await updateSetting("prompt", promptValue, "obsidian");
      // You might want to add a toast notification here
    } catch (err) {
      console.error("Failed to save settings:", err);
    }
  };

  if (loading) {
    return <div>Loading settings...</div>;
  }

  if (error) {
    return (
      <div className="text-red-600">
        Failed to load settings: {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="prompt" className="w-full">
        <TabsList>
          <TabsTrigger value="prompt">Prompt Editor</TabsTrigger>
          <TabsTrigger value="json">Settings JSON</TabsTrigger>
        </TabsList>

        <TabsContent value="prompt">
          <Card>
            <CardHeader>
              <CardTitle>Obsidian Prompt</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Prompt Template
                </label>
                <Textarea
                  rows={12}
                  value={promptValue}
                  onChange={(e) => setPromptValue(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>
              <Button onClick={handleSave}>Save Changes</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="json">
          <Card>
            <CardHeader>
              <CardTitle>Current Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted p-4 rounded-lg overflow-auto max-h-[600px]">
                <code className="text-xs font-mono whitespace-pre">
                  {JSON.stringify(settings, null, 2)}
                </code>
              </pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 