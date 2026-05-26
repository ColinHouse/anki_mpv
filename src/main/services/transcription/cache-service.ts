import { app } from "electron";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { TranscriptResult, TranscriptionProviderName } from "./types";

export type TranscriptCacheInput = {
  providerName: TranscriptionProviderName;
  language?: string;
  mediaPath?: string;
  subtitlePath?: string;
};

const getFileFingerprint = async (filePath?: string): Promise<Record<string, unknown> | null> => {
  if (!filePath) {
    return null;
  }

  try {
    const stats = await fs.stat(filePath);
    return {
      path: filePath,
      mtimeMs: stats.mtimeMs,
      size: stats.size,
    };
  } catch {
    return {
      path: filePath,
      missing: true,
    };
  }
};

const getCacheDir = (): string => {
  return path.join(app.getPath("userData"), "transcript-cache");
};

const getCachePath = async (input: TranscriptCacheInput): Promise<string> => {
  const keyPayload = {
    providerName: input.providerName,
    language: input.language ?? "ja",
    media: await getFileFingerprint(input.mediaPath),
    subtitle: await getFileFingerprint(input.subtitlePath),
  };

  const hash = crypto
    .createHash("sha256")
    .update(JSON.stringify(keyPayload))
    .digest("hex");

  return path.join(getCacheDir(), `${hash}.json`);
};

const withCacheSource = (result: TranscriptResult): TranscriptResult => {
  return {
    ...result,
    source: "cache",
    meta: {
      ...(result.meta ?? {}),
      cachedFrom: result.source,
      cacheHit: true,
    },
  };
};

export const getCachedTranscript = async (
  input: TranscriptCacheInput,
): Promise<TranscriptResult | null> => {
  try {
    const cachePath = await getCachePath(input);
    const content = await fs.readFile(cachePath, "utf8");
    const parsed = JSON.parse(content) as TranscriptResult;

    if (!Array.isArray(parsed.segments)) {
      return null;
    }

    return withCacheSource(parsed);
  } catch {
    return null;
  }
};

export const saveTranscriptCache = async (
  input: TranscriptCacheInput,
  result: TranscriptResult,
): Promise<void> => {
  const cachePath = await getCachePath(input);
  await fs.mkdir(path.dirname(cachePath), { recursive: true });

  const cachedFrom = result.meta?.cachedFrom;
  const resultToStore: TranscriptResult =
    result.source === "cache" && typeof cachedFrom === "string"
      ? {
          ...result,
          source: cachedFrom as TranscriptResult["source"],
          meta: {
            ...(result.meta ?? {}),
            cacheHit: undefined,
            cachedFrom: undefined,
          },
        }
      : result;

  await fs.writeFile(cachePath, JSON.stringify(resultToStore, null, 2), "utf8");
};

export const clearTranscriptCache = async (): Promise<void> => {
  const cacheDir = getCacheDir();
  await fs.rm(cacheDir, { recursive: true, force: true });
  await fs.mkdir(cacheDir, { recursive: true });
};

