export type TranscriptSegment = {
  id: string;
  start: number;
  end: number;
  text: string;
};

export type TranscriptResult = {
  source: "imported" | "mock-cloud" | "cloud" | "cache";
  language: string;
  segments: TranscriptSegment[];
  createdAt: string;
  meta?: Record<string, unknown>;
};

export type TranscriptionProviderName =
  | "imported-subtitle"
  | "mock-cloud"
  | "cloud";

export type TranscriptionInput = {
  mediaPath?: string;
  subtitlePath?: string;
  language?: string;
  maxDurationSeconds?: number;
};

export interface TranscriptionProvider {
  name: TranscriptionProviderName;
  transcribe(input: TranscriptionInput): Promise<TranscriptResult>;
}

