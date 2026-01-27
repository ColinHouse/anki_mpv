/* eslint-disable @typescript-eslint/no-explicit-any */
export interface QueueItem {
  id: string;
  path: string; // Actual processing path (may be cropped)
  originalPath: string; // Original path for reference
  name: string;
  status: "pending" | "processing" | "completed" | "error";
  duration?: number;
  srtPath?: string;
}

export interface Subtitle {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  translation?: string;
}

export interface WhisperProgress {
  status: "idle" | "extracting" | "processing" | "completed" | "error";
  progress: number;
  currentText?: string;
  error?: string;
  // 新增：分段识别相关属性
  currentSegment?: number;
  totalSegments?: number;
  overallProgress?: number;
  // ✅ 新增：完成时携带字幕数据
  subtitles?: any[]; // Keep as any[] for now or use Subtitle[]? Backend sends specific structure.
  srtContent?: string;
}

export interface WhisperResult {
  success: boolean;
  data?: any;
  error?: string;
}

export interface DictionaryResult {
  id: string; // 单词唯一ID (objectId)
  word: string; // 单词本体 (如 "女性")
  reading: string; // 读音/假名 (如 "じょせい")
  pronunciation: string; // 罗马音 (可选)
  definitions: string[]; // 中文释义列表 (如 ["妇女", "女性"])
  examples: {
    // 例句 (只取前3个即可)
    japanese: string;
    translation: string;
  }[];
  type?: string; // 词性 (可选)
}

export interface AnkiNoteData {
  word: string;
  reading: string;
  meaning: string;
  sentence: string;
  audioFilename?: string;
  imageFilename?: string;
  audioBase64?: string;
  imageBase64?: string;
  source?: string;
  aiExplanation?: string;
  sentenceTranslation?: string;
}

export interface SubtitleContext {
  videoPath: string;
  startTime: number;
  endTime: number;
  sentenceText: string;
  sentenceTranslation?: string;
  translation?: string;
}
