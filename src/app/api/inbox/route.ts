import { NextRequest, NextResponse } from "next/server";
import { pipe } from '@screenpipe/js';

interface VisionEvent {
  data: {
    text: string;
    app_name: string;
    image?: string;
    timestamp?: string;
  }
}

interface TranscriptionEvent {
  choices: [{
    text: string;
  }];
  metadata: {
    timestamp: string;
    device: string;
    isInput: boolean;
  }
}

interface SSEMessage {
  text: string;
  appName: string;
  timestamp: string;
  type: 'vision' | 'transcription';
  device?: string;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userQuery = searchParams.get("watch") ?? "invoice";

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  const sendEvent = async (data: SSEMessage) => {
    const sseFormatted = `data: ${JSON.stringify(data)}\n\n`;
    await writer.write(encoder.encode(sseFormatted));
  };

  // Stream both vision and transcription events
  const streamData = async () => {
    try {
      // Start both streams in parallel
      await Promise.all([
        // Vision stream
        (async () => {
          for await (const event of pipe.streamVision(false)) {
            const visionEvent = event as VisionEvent;
            if (visionEvent.data.text.toLowerCase().includes(userQuery.toLowerCase())) {
              await sendEvent({
                text: visionEvent.data.text,
                appName: visionEvent.data.app_name,
                timestamp: new Date().toISOString(),
                type: 'vision'
              });
            }
          }
        })(),

        // Transcription stream
        (async () => {
          for await (const chunk of pipe.streamTranscriptions()) {
            const transcription = chunk as TranscriptionEvent;
            if (transcription.choices[0].text.toLowerCase().includes(userQuery.toLowerCase())) {
              await sendEvent({
                text: transcription.choices[0].text,
                appName: 'Audio Transcription',
                timestamp: transcription.metadata.timestamp,
                type: 'transcription',
                device: transcription.metadata.device
              });
            }
          }
        })()
      ]);
    } catch (error) {
      console.error("Screenpipe stream error:", error);
      await writer.close();
    }
  };

  streamData().catch(async (error) => {
    console.error("Stream error:", error);
    await writer.close();
  });

  return new NextResponse(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
} 