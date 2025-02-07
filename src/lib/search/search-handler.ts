import { pipe } from "@screenpipe/js";
import { z } from 'zod';

export const searchHandler = async (query: string, timeframe: string) => {
  try {
    const searchResults = await pipe.queryScreenpipe({
      q: query,
      contentType: 'ocr', // or pass as parameter if needed
      startTime: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // last 24h
      endTime: new Date().toISOString(),
    });

    return searchResults;
  } catch (err) {
    console.error('Search error:', err);
    throw err;
  }
}; 