import type { TranscriptResult, TranscriptionInput, TranscriptionProvider } from "./types";

const wait = (milliseconds: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
};

const demoLines = [
  "今日は日本語の勉強に使う動画を見ていきます。",
  "この表現は日常会話でよく使われます。",
  "分からない単語をクリックすると、読み方と意味を確認できます。",
  "気になる文を選んで、Ankiカードに追加できます。",
  "復習するときは、動画の場面を思い出しながら答えてみましょう。",
  "同じ言葉でも、文脈によってニュアンスが少し変わります。",
  "短い字幕を何度も聞くと、自然なリズムが身につきます。",
  "このように、動画を見ながら自然に語彙を増やせます。",
];

export const mockCloudProvider: TranscriptionProvider = {
  name: "mock-cloud",
  async transcribe(input: TranscriptionInput): Promise<TranscriptResult> {
    await wait(500 + Math.floor(Math.random() * 700));

    const maxDuration = input.maxDurationSeconds ?? 48;
    const segmentDuration = Math.max(4.5, Math.min(6, maxDuration / demoLines.length));

    return {
      source: "mock-cloud",
      language: input.language ?? "ja",
      segments: demoLines.map((text, index) => {
        const start = Number((index * segmentDuration).toFixed(3));
        const end = Number(Math.min(start + segmentDuration - 0.4, maxDuration).toFixed(3));

        return {
          id: `mock-${index + 1}`,
          start,
          end,
          text,
        };
      }),
      createdAt: new Date().toISOString(),
      meta: {
        provider: "mock-cloud",
        note: "Demo transcript generated locally. No external API call was made.",
        mediaPath: input.mediaPath,
      },
    };
  },
};

