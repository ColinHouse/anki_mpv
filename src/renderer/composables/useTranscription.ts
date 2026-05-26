import { computed, ref } from "vue";
import type {
  QueueItem,
  Subtitle,
  TranscriptResult,
  TranscriptSegment,
  TranscriptionProviderName,
  WhisperProgress,
} from "../types";
import { useVideoQueue } from "./useVideoQueue";
import { generateSrtString } from "../utils/subtitle-utils";

type IpcTranscriptResponse =
  | { success: true; result: TranscriptResult | null }
  | { success: false; error: string };

const isLoading = ref(false);
const recognitionProgress = ref(0);
const isTranscriptionAvailable = ref(true);
const isAutoBatchMode = ref(false);
const isPolishing = ref(false);
const autoProcessMode = ref<"none" | "translate">("translate");
const currentActiveTaskId = ref<string | null>(null);
const polishingIds = ref<Set<string>>(new Set());

const currentProvider = ref<TranscriptionProviderName>("imported-subtitle");
const transcriptResult = ref<TranscriptResult | null>(null);
const subtitles = ref<Subtitle[]>([]);
const progressLabel = ref("Load subtitles or run Mock Cloud ASR to begin.");
const error = ref<string | null>(null);

const transcriptionStatus = ref<WhisperProgress>({
  status: "idle",
  progress: 0,
  error: "",
  currentSegment: 0,
  totalSegments: 0,
  overallProgress: 0,
});

let globalLoadVideoCallback: ((item: QueueItem) => Promise<void>) | null = null;

const toSubtitle = (segment: TranscriptSegment, index: number): Subtitle => ({
  id: segment.id || `sub-${index + 1}`,
  text: segment.text,
  startTime: segment.start,
  endTime: segment.end,
});

const providerFromResult = (result: TranscriptResult): TranscriptionProviderName => {
  if (result.source === "imported") {
    return "imported-subtitle";
  }

  if (result.source === "cloud") {
    return "cloud";
  }

  if (result.source === "cache") {
    const cachedFrom = result.meta?.cachedFrom;
    if (cachedFrom === "imported") {
      return "imported-subtitle";
    }
    if (cachedFrom === "cloud") {
      return "cloud";
    }
  }

  return "mock-cloud";
};

const applyTranscriptResult = (result: TranscriptResult) => {
  transcriptResult.value = result;
  currentProvider.value = providerFromResult(result);
  subtitles.value = result.segments.map(toSubtitle);
  recognitionProgress.value = 100;
  progressLabel.value =
    result.source === "cache"
      ? "Loaded cached transcript."
      : "Transcript is ready.";
  transcriptionStatus.value = {
    status: "completed",
    progress: 1,
    error: "",
    currentSegment: result.segments.length,
    totalSegments: result.segments.length,
    overallProgress: 1,
    subtitles: result.segments,
  };
};

const invokeTranscript = async (
  channel: string,
  input: Record<string, unknown>,
): Promise<TranscriptResult> => {
  const response = (await (window as any).api.invoke(channel, input)) as IpcTranscriptResponse;

  if (response.success === false) {
    throw new Error(response.error || "Transcription failed.");
  }

  if (!response.result) {
    throw new Error("No transcript was returned.");
  }

  return response.result;
};

export function useTranscription(loadVideoCallback?: (item: QueueItem) => Promise<void>) {
  const { videoQueue, outputDir, selectedFilePath, ensureOutputDirectory } = useVideoQueue();

  if (loadVideoCallback) {
    globalLoadVideoCallback = loadVideoCallback;
  }

  const transcriptSegments = computed(() => transcriptResult.value?.segments ?? []);
  const isRecognitionRunning = isLoading;
  const isWhisperAvailable = isTranscriptionAvailable;
  const whisperStatus = transcriptionStatus;

  const isSystemBusy = computed(() => {
    return isLoading.value || isAutoBatchMode.value;
  });

  const providerStatusLabel = computed(() => {
    if (transcriptResult.value?.source === "cache") {
      return "Cached";
    }
    if (transcriptResult.value?.source === "imported") {
      return "Imported";
    }
    if (transcriptResult.value?.source === "mock-cloud") {
      return "Mock";
    }
    if (transcriptResult.value?.source === "cloud") {
      return "Cloud";
    }
    return "Ready";
  });

  const checkEnvironment = async () => {
    isTranscriptionAvailable.value = true;
    error.value = null;
    progressLabel.value = "Subtitle-first workflow is ready.";
  };

  const runWithLoadingState = async (
    providerName: TranscriptionProviderName,
    label: string,
    action: () => Promise<TranscriptResult>,
  ): Promise<TranscriptResult | null> => {
    currentProvider.value = providerName;
    isLoading.value = true;
    recognitionProgress.value = 12;
    progressLabel.value = label;
    error.value = null;
    transcriptionStatus.value = {
      status: "processing",
      progress: 0.12,
      error: "",
      currentSegment: 0,
      totalSegments: 0,
      overallProgress: 0.12,
    };

    try {
      const result = await action();
      applyTranscriptResult(result);
      return result;
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "Transcription failed.";
      error.value = message;
      progressLabel.value = message;
      transcriptionStatus.value = {
        status: "error",
        progress: 0,
        error: message,
        currentSegment: 0,
        totalSegments: 0,
        overallProgress: 0,
      };
      return null;
    } finally {
      isLoading.value = false;
    }
  };

  const importSubtitle = async (subtitlePath?: string, mediaPath?: string) => {
    return runWithLoadingState(
      "imported-subtitle",
      "Importing subtitle file...",
      () =>
        invokeTranscript("transcription:importSubtitle", {
          subtitlePath,
          mediaPath: mediaPath ?? selectedFilePath.value ?? undefined,
          language: "ja",
        }),
    );
  };

  const runMockCloud = async (mediaPath?: string) => {
    return runWithLoadingState(
      "mock-cloud",
      "Generating demo transcript with Mock Cloud ASR...",
      () =>
        invokeTranscript("transcription:runMockCloud", {
          mediaPath: mediaPath ?? selectedFilePath.value ?? undefined,
          language: "ja",
          maxDurationSeconds: 48,
        }),
    );
  };

  const runCloud = async (mediaPath?: string) => {
    return runWithLoadingState(
      "cloud",
      "Checking cloud transcription configuration...",
      () =>
        invokeTranscript("transcription:runCloud", {
          mediaPath: mediaPath ?? selectedFilePath.value ?? undefined,
          language: "ja",
        }),
    );
  };

  const clearTranscript = () => {
    subtitles.value = [];
    transcriptResult.value = null;
    recognitionProgress.value = 0;
    error.value = null;
    progressLabel.value = "Load subtitles or run Mock Cloud ASR to begin.";
    transcriptionStatus.value = {
      status: "idle",
      progress: 0,
      error: "",
      currentSegment: 0,
      totalSegments: 0,
      overallProgress: 0,
    };
  };

  const clearTranscriptCache = async () => {
    const response = await (window as any).api.invoke("transcription:clearCache");
    if (!response?.success) {
      error.value = response?.error || "Failed to clear transcript cache.";
    }
    return response;
  };

  const loadDemoTranscript = async () => {
    return runMockCloud(selectedFilePath.value ?? undefined);
  };

  const startRecognition = async () => {
    return runMockCloud(selectedFilePath.value ?? undefined);
  };

  const triggerNextBatchItem = async () => {
    if (!isAutoBatchMode.value) return;

    const nextItem = videoQueue.value.find((item) => item.status === "pending");
    if (!nextItem) {
      isAutoBatchMode.value = false;
      progressLabel.value = "Demo batch transcription complete.";
      return;
    }

    try {
      nextItem.status = "processing";
      if (globalLoadVideoCallback) {
        await globalLoadVideoCallback(nextItem);
      }

      const result = await runMockCloud(nextItem.path);
      if (!result) {
        throw new Error(error.value || "Mock Cloud ASR failed.");
      }

      if (outputDir.value) {
        const safeName = nextItem.name
          .replace(/[\\/:*?"<>|]/g, "_")
          .replace(/\.[^/.]+$/, "");
        const srtPath = `${outputDir.value}\\${safeName}.srt`;
        await (window as any).api.invoke("save-file-direct", {
          path: srtPath,
          content: generateSrtString(subtitles.value),
        });
        nextItem.srtPath = srtPath;
      }

      nextItem.status = "completed";
      setTimeout(triggerNextBatchItem, 300);
    } catch (caughtError) {
      console.error("Demo batch transcription failed:", caughtError);
      nextItem.status = "error";
      setTimeout(triggerNextBatchItem, 300);
    }
  };

  const startBatchProcessing = async () => {
    if (videoQueue.value.length === 0) {
      alert("Please add videos first.");
      return;
    }

    const pendingTasks = videoQueue.value.filter((item) => item.status !== "completed");
    if (pendingTasks.length === 0) {
      progressLabel.value = "All queued videos already have transcripts.";
      return;
    }

    const hasOutputDirectory = await ensureOutputDirectory();
    if (!hasOutputDirectory) {
      return;
    }

    isAutoBatchMode.value = true;
    triggerNextBatchItem();
  };

  return {
    currentProvider,
    transcriptSegments,
    transcriptResult,
    subtitles,
    isLoading,
    isRecognitionRunning,
    recognitionProgress,
    progressLabel,
    error,
    providerStatusLabel,
    isTranscriptionAvailable,
    isWhisperAvailable,
    isAutoBatchMode,
    isPolishing,
    autoProcessMode,
    currentActiveTaskId,
    isSystemBusy,
    transcriptionStatus,
    whisperStatus,
    checkEnvironment,
    importSubtitle,
    runMockCloud,
    runCloud,
    clearTranscript,
    clearTranscriptCache,
    loadDemoTranscript,
    startRecognition,
    startBatchProcessing,
    triggerNextBatchItem,
    polishingIds,
    applyTranscriptResult,
  };
}
