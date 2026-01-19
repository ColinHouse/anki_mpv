import fs from "node:fs";
import path from "node:path";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import { getTempDir } from "./utils/file-utils";

// 调试：打印FFmpeg路径
console.log('🔗 FFmpeg Path:', ffmpegStatic);

ffmpeg.setFfmpegPath(ffmpegStatic || "");

const ensureTempDir = async (tempDir: string) => {
  await fs.promises.mkdir(tempDir, { recursive: true });
};


export const extractAudio = async (videoPath: string, startTime?: number, duration?: number) => {
  const tempDir = getTempDir();
  await ensureTempDir(tempDir);

  // 使用纯数字文件名避免中文乱码问题
  const outputFileName = `${Date.now()}.wav`;
  const outputPath = path.join(tempDir, outputFileName);

  return new Promise<string>((resolve, reject) => {
    // ✅ 显式类型检查，确保参数安全
    const start = typeof startTime === 'number' ? startTime : undefined;
    const dur = typeof duration === 'number' ? duration : undefined;

    console.log('📹 Processing video:', videoPath);
    console.log('🔊 Output path:', outputPath);
    console.log('⏰ Start time:', start !== undefined ? `${start}s` : 'not set');
    console.log('⏱️ Duration:', dur !== undefined ? `${dur}s` : 'not set');

    let command = ffmpeg(videoPath)
      .noVideo()
      .audioChannels(1)
      .audioFrequency(16000)
      .format("wav");

    // 添加切片参数（只在明确有数字值时才添加）
    if (start !== undefined) {
      command = command.setStartTime(start);
      console.log(`✂️ Applying start time: ${start}s`);
    }
    if (dur !== undefined) {
      command = command.setDuration(dur);
      console.log(`✂️ Applying duration: ${dur}s`);
    }

    command
      .on("end", () => {
        console.log('✅ Audio extraction completed successfully');
        resolve(outputPath);
      })
      .on("error", (error) => {
        console.error('❌ Audio extraction failed:', error);
        reject(error);
      })
      .save(outputPath);
  });
};

/**
 * 分段提取音频（用于长视频处理）
 * @param videoPath 视频文件路径
 * @param segmentDuration 每个片段的时长（秒），默认600秒（10分钟）
 * @returns 返回所有音频片段的路径数组
 */
export const extractAudioSegments = async (videoPath: string, segmentDuration = 600): Promise<string[]> => {
  const tempDir = getTempDir();
  await ensureTempDir(tempDir);

  // 创建分段目录
  const segmentsDir = path.join(tempDir, "segments");
  await fs.promises.mkdir(segmentsDir, { recursive: true });

  return new Promise((resolve, reject) => {
    console.log('📹 Processing video for segments:', videoPath);
    console.log('⏱️ Segment duration:', segmentDuration, 'seconds');

    // 使用 ffmpeg 的 segment 功能将音频切分为多个片段
    const outputPattern = path.join(segmentsDir, "chunk_%03d.wav");

    ffmpeg(videoPath)
      .noVideo()
      .audioChannels(1)
      .audioFrequency(16000)
      .format("wav")
      .outputOption("-f segment")
      .outputOption(`-segment_time ${segmentDuration}`)
      .outputOption("-reset_timestamps 1") // 重置每个片段的时间戳
      .on("end", async () => {
        console.log('✅ Audio segmentation completed successfully');
        
        // 获取所有生成的片段文件
        try {
          const files = await fs.promises.readdir(segmentsDir);
          const segmentFiles = files
            .filter(file => file.startsWith("chunk_") && file.endsWith(".wav"))
            .sort()
            .map(file => path.join(segmentsDir, file));

          console.log('📁 Generated segments:', segmentFiles.length);
          resolve(segmentFiles);
        } catch (error) {
          console.error('❌ Error reading segment files:', error);
          reject(error);
        }
      })
      .on("error", (error) => {
        console.error('❌ Audio segmentation failed:', error);
        reject(error);
      })
      .save(outputPattern);
  });
};
