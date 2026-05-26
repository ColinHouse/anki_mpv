import { dialog, ipcMain } from "electron";
import fs from "node:fs";
import { TranscriptionService } from "../services/transcription/transcription-service";
import type { TranscriptionInput, TranscriptionProviderName } from "../services/transcription/types";

type IpcResult<T> =
  | { success: true; result: T }
  | { success: false; error: string };

const getSafeErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : "Transcription failed.";
};

const getSubtitlePathFromDialog = async (): Promise<string | null> => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [
      { name: "Subtitle Files", extensions: ["srt", "vtt"] },
      { name: "All Files", extensions: ["*"] },
    ],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
};

export const registerTranscriptionHandlers = () => {
  console.log("📝 Registering transcription handlers...");

  const service = TranscriptionService.getInstance();

  ipcMain.handle(
    "transcription:importSubtitle",
    async (_event, input: TranscriptionInput = {}): Promise<IpcResult<unknown>> => {
      try {
        const subtitlePath = input.subtitlePath ?? (await getSubtitlePathFromDialog());
        if (!subtitlePath) {
          return { success: false, error: "Subtitle import was cancelled." };
        }

        if (!fs.existsSync(subtitlePath)) {
          return { success: false, error: "Subtitle file not found." };
        }

        const result = await service.importSubtitle({
          ...input,
          subtitlePath,
          language: input.language ?? "ja",
        });

        return { success: true, result };
      } catch (error) {
        console.error("Subtitle import failed:", error);
        return { success: false, error: getSafeErrorMessage(error) };
      }
    },
  );

  ipcMain.handle(
    "transcription:runMockCloud",
    async (_event, input: TranscriptionInput = {}): Promise<IpcResult<unknown>> => {
      try {
        const result = await service.runMockCloud({
          ...input,
          language: input.language ?? "ja",
        });

        return { success: true, result };
      } catch (error) {
        console.error("Mock cloud transcription failed:", error);
        return { success: false, error: getSafeErrorMessage(error) };
      }
    },
  );

  ipcMain.handle(
    "transcription:runCloud",
    async (_event, input: TranscriptionInput = {}): Promise<IpcResult<unknown>> => {
      try {
        const result = await service.runCloud({
          ...input,
          language: input.language ?? "ja",
        });

        return { success: true, result };
      } catch (error) {
        console.warn("Cloud transcription unavailable:", error);
        return { success: false, error: getSafeErrorMessage(error) };
      }
    },
  );

  ipcMain.handle(
    "transcription:getCached",
    async (
      _event,
      input: TranscriptionInput & { providerName: TranscriptionProviderName },
    ): Promise<IpcResult<unknown | null>> => {
      try {
        const result = await service.getCachedTranscript(input.providerName, input);
        return { success: true, result };
      } catch (error) {
        console.error("Failed to read transcript cache:", error);
        return { success: false, error: getSafeErrorMessage(error) };
      }
    },
  );

  ipcMain.handle("transcription:clearCache", async (): Promise<IpcResult<{ cleared: true }>> => {
    try {
      await service.clearCache();
      return { success: true, result: { cleared: true } };
    } catch (error) {
      console.error("Failed to clear transcript cache:", error);
      return { success: false, error: getSafeErrorMessage(error) };
    }
  });
};

