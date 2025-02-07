export interface ScreenpipeQuery {
  q: string
  contentType: "ocr" | "audio" | "ui" | "all" | "audio+ui" | "ocr+ui" | "audio+ocr"
  limit: number
  offset: number
  startTime?: string
  endTime?: string
  appName?: string
  windowName?: string
  includeFrames?: boolean
  minLength?: number
  maxLength?: number
  speakerIds?: number[]
  frameName?: string
}

export interface SearchResults {
  id: string
  content: string
  timestamp: string
  // Add other fields based on your actual API response
} 