"use client";

import { useState, useEffect } from "react";

// Define the Settings type structure
interface Settings {
  customSettings?: {
    [namespace: string]: {
      [key: string]: any;
    };
  };
  [key: string]: any;
}

// Get default settings function
const getDefaultSettings = (): Settings => ({
  customSettings: {
    obsidian: {
      prompt: `You are a personal data detective! 🕵️‍♂️

Rules for the investigation:
- Extract names of people I interact with and what we discussed
- When encountering a person, make sure to extract their name like this [[John Doe]]
- Identify recurring topics/themes in conversations
- Spot any promises or commitments made (by me or others)
- Catch interesting ideas or insights dropped in casual chat
- Note emotional vibes and energy levels in conversations
- Highlight potential opportunities or connections
- Track project progress and blockers mentioned

Style rules:
- Always put people's names in double square brackets, e.g., [[John Doe]]
- Same for companies [[Google]] and projects [[Project X]]
- Keep it real and conversational
- Use bullet points for clarity
- Include relevant timestamps
- Group related info together
- Max 4 lines per insight
- Use #tags for themes and topics
- For tags use hyphen between words (e.g., #my-tag not #my tag)

Remember: You're analyzing screen OCR text & audio from my computer, so focus on actual interactions and content!`,
    },
  },
});

export function useSettings() {
  const defaultSettings = getDefaultSettings();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      if (!loading) setLoading(true);
      try {
        const response = await fetch("/api/settings");
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setSettings({ ...defaultSettings, ...data });
      } catch (err) {
        console.error("Failed to load settings:", err);
        setSettings(defaultSettings);
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setLoading(false);
      }
    };

    // Initial load
    loadSettings();

    // Refresh on window focus
    const onFocus = () => loadSettings();
    window.addEventListener("focus", onFocus);

    // Periodic refresh every 30s
    const interval = setInterval(loadSettings, 30000);

    return () => {
      window.removeEventListener("focus", onFocus);
      clearInterval(interval);
    };
  }, []);

  const updateSetting = async (
    key: string,
    value: any,
    namespace?: string
  ) => {
    if (!settings) return;
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ key, value, namespace }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (namespace) {
        setSettings((prev) => {
          if (!prev) return defaultSettings;
          return {
            ...prev,
            customSettings: {
              ...prev.customSettings,
              [namespace]: {
                ...(prev.customSettings?.[namespace] || {}),
                [key]: value,
              },
            },
          };
        });
      } else {
        setSettings((prev) => {
          if (!prev) return defaultSettings;
          return { ...prev, [key]: value };
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  };

  const updateSettings = async (
    newSettings: Partial<Settings>,
    namespace?: string
  ) => {
    if (!settings) return;
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          value: newSettings,
          isPartialUpdate: true,
          namespace,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (namespace) {
        setSettings((prev) => {
          if (!prev) return defaultSettings;
          return {
            ...prev,
            customSettings: {
              ...prev.customSettings,
              [namespace]: {
                ...(prev.customSettings?.[namespace] || {}),
                ...newSettings,
              },
            },
          };
        });
      } else {
        setSettings((prev) => {
          if (!prev) return defaultSettings;
          return { ...prev, ...newSettings };
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  };

  const resetSettings = async (
    settingKey?: string,
    namespace?: string
  ) => {
    if (!settings) return;
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reset: true, key: settingKey, namespace }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (namespace) {
        setSettings((prev) => {
          if (!prev) return defaultSettings;
          if (settingKey) {
            return {
              ...prev,
              customSettings: {
                ...prev.customSettings,
                [namespace]: {
                  ...(prev.customSettings?.[namespace] || {}),
                  [settingKey]: undefined,
                },
              },
            };
          } else {
            return {
              ...prev,
              customSettings: {
                ...prev.customSettings,
                [namespace]: {},
              },
            };
          }
        });
      } else {
        if (settingKey) {
          setSettings((prev) => {
            if (!prev) return defaultSettings;
            return {
              ...prev,
              [settingKey]: defaultSettings[settingKey],
            };
          });
        } else {
          setSettings(defaultSettings);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  };

  return {
    settings: settings || defaultSettings,
    loading,
    error,
    updateSetting,
    updateSettings,
    resetSettings,
  };
} 