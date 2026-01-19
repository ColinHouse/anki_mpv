/**
 * 字幕处理工具函数
 */

export interface Subtitle {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  translation?: string; // 翻译文本（可选）
}

/**
 * 智能合并字幕算法
 * 将不完整的短句合并为长句
 */
export function smartMergeSubtitles(subtitles: Subtitle[]): Subtitle[] {
  if (!subtitles || subtitles.length === 0) {
    return [];
  }

  const merged: Subtitle[] = [];
  let i = 0;

  while (i < subtitles.length) {
    const current = { ...subtitles[i] };
    let j = i + 1;

    // 检查是否需要与下一句合并
    while (j < subtitles.length) {
      const next = subtitles[j];
      const shouldMerge = shouldMergeSubtitles(current, next);

      if (shouldMerge) {
        // 合并字幕
        current.text = current.text + next.text;
        current.endTime = next.endTime;
        j++;
      } else {
        break;
      }
    }

    merged.push(current);
    i = j;
  }

  // 重新生成ID
  return merged.map((sub, index) => ({
    ...sub,
    id: `sub-${index + 1}`,
  }));
}

/**
 * 判断两个字幕是否应该合并
 */
function shouldMergeSubtitles(current: Subtitle, next: Subtitle): boolean {
  // 条件1: 当前句尾部不包含结束标点
  const hasEndingPunctuation = /[。！？.!?…]$/.test(current.text);

  // 条件2: 时间紧凑且当前句过短
  const timeGap = next.startTime - current.endTime;
  const isTimeCompact = timeGap < 0.5;
  const isTooShort = current.text.length < 10;

  // 满足任一条件即可合并
  return !hasEndingPunctuation || (isTimeCompact && isTooShort);
}

/**
 * 解析SRT内容为字幕数组
 * 支持双语字幕分离：第一行作为原文(text)，后续行作为翻译(translation)
 */
/**
 * 解析SRT内容为字幕数组
 * 增强版：支持多种换行符、BOM头处理，并将所有文本行合并为内容
 */
export function parseSRT(srtContent: string): Subtitle[] {
  if (!srtContent) return [];

  // 1. 清理：移除BOM，统一换行符为 \n
  const cleanSrt = srtContent
    .replace(/^\uFEFF/, '') // 移除 UTF-8 BOM
    .replace(/\r\n/g, '\n') // Win -> Unix
    .replace(/\r/g, '\n')   // Mac -> Unix
    .trim();

  // 2. 分割块：按“双换行”分割，兼容中间可能有空格的情况
  const chunks = cleanSrt.split(/\n\s*\n/);
  
  const result: Subtitle[] = [];

  for (const chunk of chunks) {
    // 针对每个 block 提取
    const lines = chunk.trim().split('\n');
    if (lines.length < 2) continue; // 至少要有序号(可选)和时间轴+文本，极端情况只有时间轴+文本

    // 查找时间轴行 (包含 "-->")
    let timeIndex = -1;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('-->')) {
            timeIndex = i;
            break;
        }
    }
    
    // 如果找不到时间轴，或者是无效块，跳过
    if (timeIndex === -1) continue;

    // 提取时间 (兼容 dot . 和 comma ,)
    const timeLine = lines[timeIndex];
    const timeMatch = timeLine.match(/(\d{2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]\d{3})/);
    
    if (timeMatch) {
        const startTime = parseSRTTime(timeMatch[1]);
        const endTime = parseSRTTime(timeMatch[2]);
        
        // 提取文本：合并时间轴之后的所有行
        // 按照用户提示：const text = lines.slice(2).join(' '); 但因为我们动态找到了 timeIndex，所以是 timeIndex + 1
        const textLines = lines.slice(timeIndex + 1).map(l => l.trim()).filter(l => l !== '');
        
        // 使用换行符连接多行文本，保证视觉结构
        // 如果用户希望是空格连接，可以改为 join(' ')
        const fullText = textLines.join('\n');
        
        if (fullText) {
            result.push({
                id: `sub-${result.length + 1}`,
                startTime,
                endTime,
                text: fullText,
                translation: undefined // 暂时移除自动分割翻译的逻辑，优先保证文本完整性
            });
        }
    }
  }

  return result;
}

/**
 * 解析SRT时间格式为秒数
 */
function parseSRTTime(timeStr: string): number {
  if (!timeStr) return 0;
  
  // 将逗号替换为点号，统一格式
  const normalized = timeStr.replace(',', '.');
  const parts = normalized.split(':');
  
  if (parts.length !== 3) return 0;
  
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  const secondsAndMs = parts[2].split('.');
  const seconds = parseInt(secondsAndMs[0], 10);
  const ms = secondsAndMs[1] ? parseInt(secondsAndMs[1], 10) : 0;
  
  return hours * 3600 + minutes * 60 + seconds + ms / 1000;
}

/**
 * 格式化时间为 HH:MM:SS 格式
 */
export function formatTime(seconds: number): string {
  if (!seconds || seconds < 0) return "00:00:00";

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  return [h, m, s].map((v) => v.toString().padStart(2, "0")).join(":");
}

/**
 * 格式化秒数为SRT时间戳
 */
export function formatSRTTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

/**
 * 生成SRT格式字符串
 */
export function generateSrtString(subs: Subtitle[]): string {
    return subs
      .map((sub, index) => {
        const startTime = formatSRTTime(sub.startTime);
        const endTime = formatSRTTime(sub.endTime);
        let text = sub.text;
        if (sub.translation) {
          text += "\n" + sub.translation;
        }
        return `${index + 1}\n${startTime} --> ${endTime}\n${text}\n`;
      })
      .join("\n");
};
