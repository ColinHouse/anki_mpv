import { parseSubtitleFile } from "./subtitle-parser";
import {
  clearTranscriptCache,
  getCachedTranscript,
  saveTranscriptCache,
  type TranscriptCacheInput,
} from "./cache-service";
import { cloudProvider } from "./cloud-provider";
import { mockCloudProvider } from "./mock-cloud-provider";
import type {
  TranscriptResult,
  TranscriptionInput,
  TranscriptionProvider,
  TranscriptionProviderName,
} from "./types";

const importedSubtitleProvider: TranscriptionProvider = {
  name: "imported-subtitle",
  async transcribe(input: TranscriptionInput): Promise<TranscriptResult> {
    if (!input.subtitlePath) {
      throw new Error("Please choose a .srt or .vtt subtitle file.");
    }

    const segments = await parseSubtitleFile(input.subtitlePath);
    if (segments.length === 0) {
      throw new Error("No subtitle cues were found in this file.");
    }

    return {
      source: "imported",
      language: input.language ?? "ja",
      segments,
      createdAt: new Date().toISOString(),
      meta: {
        provider: "imported-subtitle",
        subtitlePath: input.subtitlePath,
        mediaPath: input.mediaPath,
      },
    };
  },
};

const providers: Record<TranscriptionProviderName, TranscriptionProvider> = {
  "imported-subtitle": importedSubtitleProvider,
  "mock-cloud": mockCloudProvider,
  cloud: cloudProvider,
};

export class TranscriptionService {
  private static instance: TranscriptionService | null = null;

  static getInstance(): TranscriptionService {
    if (!this.instance) {
      this.instance = new TranscriptionService();
    }

    return this.instance;
  }

  async transcribe(
    providerName: TranscriptionProviderName,
    input: TranscriptionInput,
  ): Promise<TranscriptResult> {
    const provider = providers[providerName];
    if (!provider) {
      throw new Error(`Unknown transcription provider: ${providerName}`);
    }

    const cacheInput = this.getCacheInput(providerName, input);
    const cached = await getCachedTranscript(cacheInput);
    if (cached) {
      return cached;
    }

    const result = await provider.transcribe(input);
    await saveTranscriptCache(cacheInput, result);

    return result;
  }

  async importSubtitle(input: TranscriptionInput): Promise<TranscriptResult> {
    return this.transcribe("imported-subtitle", input);
  }

  async runMockCloud(input: TranscriptionInput): Promise<TranscriptResult> {
    return this.transcribe("mock-cloud", input);
  }

  async runCloud(input: TranscriptionInput): Promise<TranscriptResult> {
    return this.transcribe("cloud", input);
  }

  async getCachedTranscript(
    providerName: TranscriptionProviderName,
    input: TranscriptionInput,
  ): Promise<TranscriptResult | null> {
    return getCachedTranscript(this.getCacheInput(providerName, input));
  }

  async clearCache(): Promise<void> {
    await clearTranscriptCache();
  }

  private getCacheInput(
    providerName: TranscriptionProviderName,
    input: TranscriptionInput,
  ): TranscriptCacheInput {
    return {
      providerName,
      language: input.language ?? "ja",
      mediaPath: input.mediaPath,
      subtitlePath: input.subtitlePath,
    };
  }
}

