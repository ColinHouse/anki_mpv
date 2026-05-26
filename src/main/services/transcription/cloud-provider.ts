import { readSettings } from "../settings";
import type { TranscriptResult, TranscriptionInput, TranscriptionProvider } from "./types";

const getConfiguredApiKey = (): string | undefined => {
  const settings = readSettings() as {
    cloudTranscriptionApiKey?: string;
    openAiApiKey?: string;
  };

  return (
    settings.cloudTranscriptionApiKey ||
    settings.openAiApiKey ||
    process.env.CLOUD_ASR_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    process.env.AZURE_SPEECH_KEY ||
    process.env.AWS_ACCESS_KEY_ID
  );
};

export const cloudProvider: TranscriptionProvider = {
  name: "cloud",
  async transcribe(_input: TranscriptionInput): Promise<TranscriptResult> {
    const apiKey = getConfiguredApiKey();

    if (!apiKey) {
      throw new Error(
        "Cloud transcription is not configured. Please use Mock Cloud mode or import subtitles.",
      );
    }

    throw new Error(
      "Cloud transcription is configured but no real ASR backend is connected yet. Use Mock Cloud mode for demos.",
    );
  },
};

