import { pipe } from "@screenpipe/browser";

interface TranscriptionChunk {
  choices: Array<{ text: string }>;
  metadata?: {
    timestamp: string;
    device: string;
    isInput: boolean;
  };
}

async function printLiveTranscriptions() {
  console.log("Starting audio transcription stream...");

  try {
    for await (const chunk of pipe.streamTranscriptions()) {
      console.log("chunk", chunk);
      if (!chunk.metadata) {
        console.warn("Received chunk without metadata:", chunk);
        continue;
      }

      // Format and print the transcription
      const timestamp = new Date(chunk.metadata.timestamp).toLocaleTimeString();
      const direction = chunk.metadata.isInput ? "Input" : "Output";
      const device = chunk.metadata.device;
      const text = chunk.choices[0].text;

      console.log(`[${timestamp}] ${direction} (${device}): ${text}`);
    }
  } catch (err) {
    console.error("Audio stream error:", err);
  }
}

// Start the transcription stream
printLiveTranscriptions().catch(console.error);
