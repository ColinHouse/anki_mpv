import fs from "node:fs/promises";
import path from "node:path";
import type { TranscriptSegment } from "./types";

const TIMESTAMP_SEPARATOR = "-->";

const normalizeText = (text: string): string => {
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/\u200e|\u200f/g, "")
    .trim();
};

export const timestampToSeconds = (value: string): number => {
  const normalized = value.trim().replace(",", ".");
  const parts = normalized.split(":");

  if (parts.length < 2 || parts.length > 3) {
    return 0;
  }

  const secondsPart = parts[parts.length - 1];
  const [seconds = "0", milliseconds = "0"] = secondsPart.split(".");
  const minutes = parts[parts.length - 2] ?? "0";
  const hours = parts.length === 3 ? parts[0] : "0";

  return (
    Number(hours) * 3600 +
    Number(minutes) * 60 +
    Number(seconds) +
    Number(milliseconds.padEnd(3, "0").slice(0, 3)) / 1000
  );
};

const parseCueTimeLine = (line: string): { start: number; end: number } | null => {
  if (!line.includes(TIMESTAMP_SEPARATOR)) {
    return null;
  }

  const [startRaw, endRawWithSettings] = line.split(TIMESTAMP_SEPARATOR);
  const endRaw = endRawWithSettings.trim().split(/\s+/)[0];

  if (!startRaw || !endRaw) {
    return null;
  }

  return {
    start: timestampToSeconds(startRaw),
    end: timestampToSeconds(endRaw),
  };
};

export const parseSubtitleContent = (content: string): TranscriptSegment[] => {
  const cleanContent = content
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();

  if (!cleanContent) {
    return [];
  }

  const blocks = cleanContent.split(/\n\s*\n/);
  const segments: TranscriptSegment[] = [];

  for (const block of blocks) {
    const lines = block
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      continue;
    }

    const firstLine = lines[0].toUpperCase();
    if (
      firstLine.startsWith("WEBVTT") ||
      firstLine.startsWith("NOTE") ||
      firstLine.startsWith("STYLE") ||
      firstLine.startsWith("REGION")
    ) {
      continue;
    }

    const timeIndex = lines.findIndex((line) => line.includes(TIMESTAMP_SEPARATOR));
    if (timeIndex === -1) {
      continue;
    }

    const cueTimes = parseCueTimeLine(lines[timeIndex]);
    if (!cueTimes || cueTimes.end <= cueTimes.start) {
      continue;
    }

    const text = normalizeText(lines.slice(timeIndex + 1).join("\n"));
    if (!text) {
      continue;
    }

    segments.push({
      id: `seg-${segments.length + 1}`,
      start: cueTimes.start,
      end: cueTimes.end,
      text,
    });
  }

  return segments;
};

export const parseSubtitleFile = async (subtitlePath: string): Promise<TranscriptSegment[]> => {
  const extension = path.extname(subtitlePath).toLowerCase();
  if (![".srt", ".vtt"].includes(extension)) {
    throw new Error("Unsupported subtitle format. Please import a .srt or .vtt file.");
  }

  const content = await fs.readFile(subtitlePath, "utf8");
  return parseSubtitleContent(content);
};

