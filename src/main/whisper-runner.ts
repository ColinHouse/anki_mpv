import {spawn, ChildProcess } from "child_process";
import fs from "node:fs";
import path from "node:path";
import { app, BrowserWindow } from "electron";
import ffmpeg from "fluent-ffmpeg";
import { ensureModel, getModelPath } from "./ensureModel";
import { WhisperExecutor } from "./whisper/WhisperExecutor";
import { WhisperTaskContext, WhisperProgress as ModularWhisperProgress, WhisperResult as ModularWhisperResult } from "./whisper/types";
import { parseTimestamp } from "./whisper/WhisperParser";
// Import shared types
import { WhisperProgress, WhisperResult } from "../renderer/types";

// 设置存储：在 app.getPath('userData') 下创建一个 settings.json 文件用于持久化配置
// 获取 settings.json 路径（延迟获取，防止 app 未就绪）
const getSettingsPath = () => path.join(app.getPath("userData"), "settings.json");

// 获取默认设置
const getDefaultSettings = () => ({
  activeModel: "small",
  llmUrl: "http://localhost:11434"
});

// 读取设置
const readSettings = () => {
  try {
    const settingsPath = getSettingsPath();
    if (fs.existsSync(settingsPath)) {
      const content = fs.readFileSync(settingsPath, "utf8");
      return JSON.parse(content);
    }
  } catch (error) {
    console.warn("⚠️ Failed to read settings:", error);
  }
  return getDefaultSettings();
};



export class WhisperRunner {
  private mainWindow: BrowserWindow | null;
  private whisperProcess: ChildProcess | null = null;

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
  }

  /**
   * 查找Whisper可执行文件
   */
  private findWhisperExecutable(): string | null {
    try {
      // 1. 优先查找手动放置的本地环境 (resources/bin/whisper.exe)
      const localWhisperPath = path.join(
        process.cwd(),
        "resources",
        "bin",
        "whisper.exe"
      );

      if (fs.existsSync(localWhisperPath)) {
        console.log("🔗 Found local whisper executable:", localWhisperPath);
        return localWhisperPath;
      }

      // 2. 查找 whisper-node 包中的可执行文件
      const whisperNodePath = path.join(
        app.getAppPath(),
        "node_modules",
        "whisper-node",
        "bin",
        process.platform === "win32" ? "whisper.exe" : "whisper"
      );

      if (fs.existsSync(whisperNodePath)) {
        console.log("🔗 Found whisper-node executable:", whisperNodePath);
        return whisperNodePath;
      }

      // 3. 查找项目根目录的whisper可执行文件
      const projectWhisperPath = path.join(
        app.getAppPath(),
        process.platform === "win32" ? "whisper.exe" : "whisper"
      );

      if (fs.existsSync(projectWhisperPath)) {
        console.log("🔗 Found project whisper executable:", projectWhisperPath);
        return projectWhisperPath;
      }

      // 4. 尝试从PATH环境变量查找
      const envPath = process.env.PATH?.split(path.delimiter);
      if (envPath) {
        for (const dir of envPath) {
          const pathInEnv = path.join(
            dir,
            process.platform === "win32" ? "whisper.exe" : "whisper"
          );
          if (fs.existsSync(pathInEnv)) {
            console.log("🔗 Found whisper in PATH:", pathInEnv);
            return pathInEnv;
          }
        }
      }

      console.warn("⚠️ Whisper executable not found");
      return null;
    } catch (error) {
      console.error("❌ Error finding whisper executable:", error);
      return null;
    }
  }

  /**
   * 获取音频文件时长
   */
  private async getAudioDuration(audioPath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(audioPath, (err: any, metadata: any) => {
        if (err) {
          console.error("❌ Error getting audio duration:", err);
          reject(err);
        } else {
          const duration = metadata.format.duration;
          console.log("⏱️ Audio duration:", duration, "seconds");
          resolve(duration);
        }
      });
    });
  }

  /**
   * 解析Whisper输出中的时间戳
   */
  private parseTimestamp(line: string): number | null {
    // 匹配 [00:00:00.000 --> 00:00:05.000] 格式
    const timestampRegex =
      /\[(\d{2}:\d{2}:\d{2}\.\d{3}) --> (\d{2}:\d{2}:\d{2}\.\d{3})\]/;
    const match = line.match(timestampRegex);

    if (match) {
      const endTimeStr = match[2]; // 获取结束时间
      const timeParts = endTimeStr.split(":");
      const hours = parseInt(timeParts[0], 10);
      const minutes = parseInt(timeParts[1], 10);
      const seconds = parseFloat(timeParts[2]);

      const totalSeconds = hours * 3600 + minutes * 60 + seconds;
      return totalSeconds;
    }

    return null;
  }

  /**
   * 运行Whisper语音识别（单个文件）
   * @param taskId - 任务唯一ID（从前端传入）
   * @param audioPath - 音频文件路径
   * @param language - 识别语言
   */
  public async runWhisper(
    taskId: string,
    audioPath: string,
    language = "ja"
  ): Promise<WhisperResult> {
    try {
      // ✅ 防止多进程冲突：如果有进程在运行，拒绝新任务
      if (this.whisperProcess) {
        const errorMsg = 'Whisper is already running a task. Please wait for completion.';
        console.error(`❌ ${errorMsg}`);
        this.sendProgress(taskId, { 
          status: "error", 
          progress: 0, 
          error: errorMsg 
        });
        throw new Error(errorMsg);
      }

      const whisperPath = this.findWhisperExecutable();

      if (!whisperPath) {
        const error = "Whisper executable not found";
        this.sendProgress(taskId, { status: "error", progress: 0, error });
        throw new Error(error);
      }

      // 读取设置获取 activeModel
      const settings = readSettings();
      const rawModel = settings.activeModel || "small";
      const activeModel = rawModel.toLowerCase(); // ✅ 强制小写标准化

      // Ensure model is available
      const modelReady = await ensureModel(activeModel);
      if (!modelReady) {
        const error = "Failed to download or verify model";
        this.sendProgress(taskId, { status: "error", progress: 0, error });
        throw new Error(error);
      }

      // 获取音频时长用于进度计算
      let audioDuration = 0;

      try {
        audioDuration = await this.getAudioDuration(audioPath);
      } catch (error) {
        console.warn(
          "⚠️ Could not get audio duration, using estimated progress"
        );
      }

      // 使用新的 WhisperExecutor
      const modelPath = getModelPath(activeModel);
      const context: WhisperTaskContext = {
        id: taskId,
        videoPath: "", // Not used for direct audio processing
        audioPath,
        modelPath,
        language,
      };

      const executor = new WhisperExecutor(this.mainWindow!);
      const result = await executor.execute(context, whisperPath, audioDuration);
      return result;
    } catch (error) {
      console.error("❌ Error running Whisper:", error);
      this.sendProgress(taskId, {
        status: "error",
        progress: 0,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 发送进度更新到前端（带任务ID）
   */
  private sendProgress(taskId: string, progress: WhisperProgress): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      // 确保进度对象包含任务ID
      const progressWithId = { ...progress, id: taskId };
      this.mainWindow.webContents.send("whisper-status", progressWithId);
      console.log("📊 Progress update:", progressWithId);
    }
  }

  /**
   * 停止Whisper进程
   * @param taskId - 任务ID
   */
  public stopWhisper(taskId: string = "unknown"): void {
    if (this.whisperProcess) {
      console.log("🛑 Stopping Whisper process...");
      this.whisperProcess.kill("SIGTERM");
      this.whisperProcess = null;
      this.sendProgress(taskId, {
        status: "error",
        progress: 0,
        error: "Process stopped by user",
      });
    }
  }

  /**
   * 智能运行Whisper（根据视频时长自动选择策略）
   * @param taskId 任务唯一ID
   * @param videoPath 视频文件路径
   * @param language 语言
   * @param activeModel 模型类型
   * @returns 识别结果
   */
  public async smartRunWhisper(
    taskId: string,
    videoPath: string,
    language = "ja",
    activeModel: "small" | "base" | "medium"
  ): Promise<WhisperResult> {
    try {
      // 获取视频时长
      const duration = await this.getVideoDuration(videoPath);
      console.log(
        `📹 Video duration: ${duration} seconds (${(duration / 60).toFixed(1)} minutes)`
      );

      // 智能分支判断
      if (duration <= 900) {
        // <= 15分钟
        console.log("🎯 Short video detected, using single recognition");
        return await this._runSingleTrack(taskId, videoPath, language, activeModel);
      } else {
        // > 15分钟
        console.log("🎯 Long video detected, using segmented recognition");
        return await this._runSegmentedTrack(taskId, videoPath, language);
      }
    } catch (error) {
      console.error("❌ Error in smartRunWhisper:", error);
      this.sendProgress(taskId, {
        status: "error",
        progress: 0,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 获取视频时长
   */
  private async getVideoDuration(videoPath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err: any, metadata: any) => {
        if (err) {
          console.error("❌ Error getting video duration:", err);
          reject(err);
        } else {
          const duration = metadata.format.duration;
          console.log("⏱️ Video duration:", duration, "seconds");
          resolve(duration);
        }
      });
    });
  }

  /**
   * 单轨识别短视频
   */
  private async _runSingleTrack(
    taskId: string,
    videoPath: string,
    language = "ja",
    activeModel: "small" | "base" | "medium"
  ): Promise<WhisperResult> {
    try {
      const whisperPath = this.findWhisperExecutable();
      if (!whisperPath) throw new Error("Whisper executable not found");

      const modelReady = await ensureModel(activeModel);
      if (!modelReady) throw new Error("Model not ready");

      // 提取音频
      const { extractAudio } = await import("./audio-processing");
      const audioPath = await extractAudio(videoPath);
      
      // 获取时长
      let audioDuration = 0;
      try { audioDuration = await this.getAudioDuration(audioPath); } catch (e) {}

      // 执行识别
      const modelPath = getModelPath(activeModel);
      const context: WhisperTaskContext = { id: taskId, videoPath, audioPath, modelPath, language };
      const executor = new WhisperExecutor(this.mainWindow!);
      
      // 执行，但不依赖其返回的数据
      const result = await executor.execute(context, whisperPath, audioDuration);

      // 🟢【暴力读取】直接去硬盘找文件
      let finalSrtContent = "";
      let finalSubtitles: any[] = [];
      
      // Whisper 可能会生成 audio.wav.srt 或 audio.srt
      const candidates = [audioPath + ".srt", audioPath.replace(/\.wav$/, ".srt")];
      
      for (const p of candidates) {
          if (fs.existsSync(p)) {
            console.log("📦 Found SRT file on disk:", p);
            // ✅ 关键：读取时去除 BOM 头 (\uFEFF)
            const raw = fs.readFileSync(p, "utf-8");
            finalSrtContent = raw.replace(/^\uFEFF/, '').trim();
            
            // 尝试解析（仅用于UI显示，不影响保存）
          try {
            finalSubtitles = this.parseSRTWithOffset(finalSrtContent, 0);
          } catch (e) {
            console.warn("Parse error (ignored):", e);
          }
          
          // 顺便删掉临时文件
          try { fs.unlinkSync(p); } catch(e) {}
          break;
        }
      }

      if (result.success) {
        // 🟢【强制发货】只要 result.success 为 true，必须发送 completed
        // 即使没有内容，也发一个空字符串，防止前端永久等待
        this.sendProgress(taskId, {
          status: "completed",
          progress: 1.0,
          subtitles: finalSubtitles, 
          srtContent: finalSrtContent || "" // 确保不为 undefined
        });
      }
      
      return result;
    } catch (error) {
      console.error("❌ Error in _runSingleTrack:", error);
      this.sendProgress(taskId, { status: "error", progress: 0, error: (error as Error).message });
      throw error;
    }
  }

  /**
   * 分段识别长视频
   */
  private async _runSegmentedTrack(
    taskId: string,
    videoPath: string,
    language = "ja"
  ): Promise<WhisperResult> {
    try {
      const whisperPath = this.findWhisperExecutable();
      if (!whisperPath) {
        const error = "Whisper executable not found";
        this.sendProgress(taskId, { status: "error", progress: 0, error });
        throw new Error(error);
      }

      // 读取设置获取 activeModel
      const settings = readSettings();
      const rawModel = settings.activeModel || "small";
      const activeModel = rawModel.toLowerCase(); // ✅ 强制小写标准化

      // Ensure model is available
      const modelReady = await ensureModel(activeModel);
      if (!modelReady) {
        const error = "Failed to download or verify model";
        this.sendProgress(taskId, { status: "error", progress: 0, error });
        throw new Error(error);
      }

      // 分段提取音频
      const { extractAudioSegments } = await import("./audio-processing");
      const segments = await extractAudioSegments(videoPath, 600); // 10分钟片段
      console.log(`📁 Generated ${segments.length} audio segments`);

      if (segments.length === 0) {
        throw new Error("No audio segments were generated");
      }

      // 创建最终SRT文件路径
      const finalSrtPath = videoPath.replace(
        /\.(mp4|mkv|avi|mov|wmv|flv|webm)$/i,
        "_full.srt"
      );

      // 清空或创建最终SRT文件
      fs.writeFileSync(finalSrtPath, "", "utf8");
      console.log(`📝 Created final SRT file: ${finalSrtPath}`);

      const totalSegments = segments.length;
      const allSubtitles: any[] = [];

      // 逐个处理片段
      for (let i = 0; i < segments.length; i++) {
        const segmentPath = segments[i];
        const timeOffset = i * 600; // 每个片段10分钟

        console.log(
          `🎵 Processing segment ${i + 1}/${totalSegments}, offset: ${timeOffset}s`
        );

        // 发送总体进度状态
        this.sendProgress(taskId, {
          status: "processing",
          progress: 0, // 当前片段进度从0开始
          currentSegment: i + 1,
          totalSegments: totalSegments,
          overallProgress: i / totalSegments,
        });

        // 构建Whisper命令 - 使用动态模型路径
        const modelPath = getModelPath(activeModel);
        const args = [
          "-m",
          modelPath,
          "-f",
          segmentPath,
          "-l",
          language,
          "-osrt",
          "-t",
          "4",
        ];

        // 运行Whisper识别当前片段
        await new Promise<void>((resolve, reject) => {
          let segmentProgress = 0;
          let lastUpdateTime = Date.now();

          this.whisperProcess = spawn(whisperPath, args, {
            stdio: ["pipe", "pipe", "pipe"],
            cwd: path.dirname(whisperPath),
          });

          // 监听Whisper输出以获取片段内进度
          this.whisperProcess!.stdout?.on("data", (data) => {
            const output = data.toString();

            // 解析时间戳来估算片段内进度
            const lines = output.split("\n");
            for (const line of lines) {
              const timestampSeconds = this.parseTimestamp(line);
              if (timestampSeconds !== null && timestampSeconds <= 600) {
                // 片段最大10分钟
                segmentProgress = Math.min(timestampSeconds / 600, 1.0);

                // 更新总体进度：已完成片段 + 当前片段进度
                const overallProgress = (i + segmentProgress) / totalSegments;

                // 限制更新频率，避免过于频繁的IPC通信
                const now = Date.now();
                if (now - lastUpdateTime > 100) {
                  // 100ms间隔
                  this.sendProgress(taskId, {
                    status: "processing",
                    progress: segmentProgress, // 当前片段进度
                    currentSegment: i + 1,
                    totalSegments: totalSegments,
                    overallProgress: overallProgress,
                  });
                  lastUpdateTime = now;
                }
              }
            }
          });

          this.whisperProcess!.on("close", async (code) => {
            if (code === 0) {
              // 读取当前片段的SRT结果
              const segmentSrtPath = segmentPath + ".srt";
              const defaultSegmentSrtPath = segmentPath.replace(
                /\.wav$/,
                ".srt"
              );

              let segmentSrtContent = "";
              try {
                if (fs.existsSync(defaultSegmentSrtPath)) {
                  segmentSrtContent = fs.readFileSync(
                    defaultSegmentSrtPath,
                    "utf8"
                  );
                } else if (fs.existsSync(segmentSrtPath)) {
                  segmentSrtContent = fs.readFileSync(segmentSrtPath, "utf8");
                } else {
                  console.warn(`⚠️ SRT file not found for segment ${i + 1}`);
                  resolve();
                  return;
                }
              } catch (error) {
                console.error(
                  `❌ Error reading SRT for segment ${i + 1}:`,
                  error
                );
                resolve();
                return;
              }

              // 解析并添加时间偏移
              const shiftedSubtitles = this.parseSRTWithOffset(
                segmentSrtContent,
                timeOffset
              );

              // 添加到总字幕列表
              allSubtitles.push(...shiftedSubtitles);

              // 追加到最终SRT文件
              const shiftedSrtContent =
                this.generateSRTContent(shiftedSubtitles);
              fs.appendFileSync(finalSrtPath, shiftedSrtContent);

              // 发送片段完成事件给前端追加显示
              this.mainWindow?.webContents.send("whisper-chunk-completed", {
                subtitles: shiftedSubtitles,
                segmentIndex: i + 1,
                totalSegments: totalSegments,
              });

              console.log(
                `✅ Segment ${i + 1} completed, added ${shiftedSubtitles.length} subtitles`
              );

              // 清理临时文件
              try {
                if (fs.existsSync(segmentPath)) fs.unlinkSync(segmentPath);
                if (fs.existsSync(defaultSegmentSrtPath))
                  fs.unlinkSync(defaultSegmentSrtPath);
                if (fs.existsSync(segmentSrtPath))
                  fs.unlinkSync(segmentSrtPath);
              } catch (cleanupError) {
                console.warn(
                  "⚠️ Failed to clean up segment files:",
                  cleanupError
                );
              }

              resolve();
            } else {
              const errorMsg = `Segment ${i + 1} failed with code ${code}`;
              console.error("❌", errorMsg);
              reject(new Error(errorMsg));
            }
          });

          this.whisperProcess!.on("error", (err) => {
            console.error(`❌ Segment ${i + 1} spawn error:`, err);
            reject(err);
          });
        });
      }

      // Generate final SRT content
      const finalSrtContent = this.generateSRTContent(allSubtitles);

      // ✅ Send final completion status WITH subtitle data
      this.sendProgress(taskId, {
        status: "completed",
        progress: 1.0,
        overallProgress: 1.0,
        subtitles: allSubtitles,
        srtContent: finalSrtContent
      });

      console.log(
        `🎉 All segments completed! Total subtitles: ${allSubtitles.length}`
      );

      return {
        success: true,
        data: {
          srtContent: finalSrtContent,
          srtPath: finalSrtPath,
          subtitles: allSubtitles,
        },
      };
    } catch (error) {
      console.error("❌ Error in runSegmentedWhisper:", error);
      this.sendProgress(taskId, {
        status: "error",
        progress: 0,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 生成SRT格式内容
   */
  private generateSRTContent(subtitles: any[]): string {
    let content = "";
    let subtitleIndex = 1;

    for (const subtitle of subtitles) {
      // 确保字幕有有效的文本内容
      if (!subtitle.text || subtitle.text.trim() === "") {
        continue;
      }

      content += `${subtitleIndex}\n`;
      content += `${this.formatSRTTime(subtitle.start)} --> ${this.formatSRTTime(subtitle.end)}\n`;
      content += `${subtitle.text.trim()}\n\n`;
      subtitleIndex++;
    }

    return content;
  }

  /**
   * 格式化SRT时间格式
   */
  private formatSRTTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);

    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")},${ms.toString().padStart(3, "0")}`;
  }

  /**
   * 检查Whisper是否可用
   */
  public isWhisperAvailable(): boolean {
    return this.findWhisperExecutable() !== null;
  }

  /**
   * 解析SRT内容并添加时间偏移
   * @param srtContent SRT文件内容
   * @param timeOffset 时间偏移量（秒）
   * @returns 解析后的字幕数组
   */
  private parseSRTWithOffset(srtContent: string, timeOffset: number): any[] {
    const lines = srtContent.split("\n");
    const subtitles: any[] = [];
    let currentSubtitle: any = null;
    let textBuffer: string[] = [];

    for (const line of lines) {
      const trimmedLine = line.trim();

      // 跳过空行
      if (!trimmedLine) {
        if (currentSubtitle && textBuffer.length > 0) {
          currentSubtitle.text = textBuffer.join(" ");
          // 确保字幕有有效的时间戳和文本
          if (
            currentSubtitle.start !== undefined &&
            currentSubtitle.end !== undefined &&
            currentSubtitle.text.trim()
          ) {
            subtitles.push(currentSubtitle);
          }
          currentSubtitle = null;
          textBuffer = [];
        }
        continue;
      }

      // 检查是否是序号行
      if (/^\d+$/.test(trimmedLine) && !currentSubtitle) {
        continue; // 跳过序号
      }
      // 检查是否是时间戳行
      else if (
        /^\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}$/.test(
          trimmedLine
        )
      ) {
        if (currentSubtitle && textBuffer.length > 0) {
          currentSubtitle.text = textBuffer.join(" ");
          // 确保字幕有有效的时间戳和文本
          if (
            currentSubtitle.start !== undefined &&
            currentSubtitle.end !== undefined &&
            currentSubtitle.text.trim()
          ) {
            subtitles.push(currentSubtitle);
          }
          textBuffer = [];
        }

        const [start, end] = trimmedLine.split(" --> ");
        currentSubtitle = {
          start: this.parseSRTTime(start) + timeOffset,
          end: this.parseSRTTime(end) + timeOffset,
          text: "",
        };
      }
      // 文本行
      else if (currentSubtitle) {
        textBuffer.push(trimmedLine);
      }
    }

    // 处理最后一个字幕
    if (currentSubtitle && textBuffer.length > 0) {
      currentSubtitle.text = textBuffer.join(" ");
      // 确保字幕有有效的时间戳和文本
      if (
        currentSubtitle.start !== undefined &&
        currentSubtitle.end !== undefined &&
        currentSubtitle.text.trim()
      ) {
        subtitles.push(currentSubtitle);
      }
    }

    return subtitles;
  }

  /**
   * 解析SRT时间格式为秒数
   * @param timeStr SRT时间字符串 (HH:MM:SS,mmm)
   * @returns 秒数
   */
  private parseSRTTime(timeStr: string): number {
    const [timePart, msPart] = timeStr.split(",");
    const [hours, minutes, seconds] = timePart.split(":").map(Number);
    const milliseconds = Number(msPart) / 1000;

    return hours * 3600 + minutes * 60 + seconds + milliseconds;
  }

  /**
   * 运行分段Whisper语音识别（用于长视频）
   * @param taskId 任务唯一ID
   * @param audioPaths 音频片段路径数组
   * @param language 语言
   * @param segmentDuration 每个片段的时长（秒）
   */
  public async runWhisperSegments(
    taskId: string,
    audioPaths: string[],
    language = "ja",
    segmentDuration = 600
  ): Promise<void> {
    try {
      const whisperPath = this.findWhisperExecutable();

      if (!whisperPath) {
        const error = "Whisper executable not found";
        this.sendProgress(taskId, { status: "error", progress: 0, error });
        throw new Error(error);
      }

      // 读取设置获取 activeModel
      const settings = readSettings();
      const activeModel = settings.activeModel || "small";

      // Ensure model is available
      const modelReady = await ensureModel(activeModel);
      if (!modelReady) {
        const error = "Failed to download or verify model";
        this.sendProgress(taskId, { status: "error", progress: 0, error });
        throw new Error(error);
      }

      // 构建命令参数 - 使用动态模型路径
      const modelPath = getModelPath(activeModel);

      // 逐个处理每个片段
      for (let i = 0; i < audioPaths.length; i++) {
        const audioPath = audioPaths[i];
        const timeOffset = i * segmentDuration; // 计算时间偏移量

        console.log(
          `🎵 Processing segment ${i + 1}/${audioPaths.length}, time offset: ${timeOffset}s`
        );

        // 构建命令参数
        const args = [
          "-m",
          modelPath,
          "-f",
          audioPath,
          "-l",
          language,
          "-osrt", // 输出SRT格式
          "-t",
          "4", // 线程数
        ];

        console.log(`🚀 Starting Whisper segment ${i + 1} with args:`, args);

        // 启动Whisper进程
        const workDir = path.dirname(whisperPath);
        this.whisperProcess = spawn(whisperPath, args, {
          stdio: ["pipe", "pipe", "pipe"],
          cwd: workDir,
        });

        await new Promise<void>((resolve, reject) => {
          let currentText = "";

          // 监听启动错误
          this.whisperProcess!.on("error", (err) => {
            console.error("❌ Spawn Error:", err);
            this.sendProgress(taskId, {
              status: "error",
              progress: 0,
              error: err.message,
            });
            resolve();
          });

          // 监听标准输出
          this.whisperProcess!.stdout?.on("data", (data) => {
            const output = data.toString();
            console.log(`📢 Whisper segment ${i + 1} stdout:`, output);
            currentText += output;
          });

          // 监听错误输出
          this.whisperProcess!.stderr?.on("data", (data) => {
            const errorOutput = data.toString();
            console.log(`📢 Whisper segment ${i + 1} stderr:`, errorOutput);
          });

          // 监听进程结束
          this.whisperProcess!.on("close", (code) => {
            console.log(`🏁 Whisper segment ${i + 1} exited with code:`, code);

            if (code === 0) {
              // Whisper 默认生成的文件名（追加模式）
              const defaultGeneratedPath = audioPath + ".srt";
              // 目标文件名（替换模式）
              const targetSrtPath = audioPath.replace(/\.wav$/, ".srt");

              // 延迟 1s 确保 Whisper 彻底释放文件句柄
              setTimeout(() => {
                try {
                  if (fs.existsSync(defaultGeneratedPath)) {
                    // 1. 读取原始内容
                    const rawBuffer = fs.readFileSync(defaultGeneratedPath);

                    // 2. 添加 BOM 头 (\uFEFF) 解决 Windows 乱码
                    const bomBuffer = Buffer.from([0xef, 0xbb, 0xbf]);
                    const finalBuffer = Buffer.concat([bomBuffer, rawBuffer]);

                    // 3. 写入新文件 (覆盖目标路径)
                    fs.writeFileSync(targetSrtPath, finalBuffer);
                    console.log(
                      "✅ SRT processed and saved to:",
                      targetSrtPath
                    );

                    // 4. 删除旧文件 (如果新旧路径不同)
                    if (defaultGeneratedPath !== targetSrtPath) {
                      fs.unlinkSync(defaultGeneratedPath);
                    }

                    // 5. 返回数据
                    const srtContent = finalBuffer.toString("utf8");
                    this.sendProgress(taskId, { status: "completed", progress: 1.0 }); // 发送最终完成状态
                    resolve();
                  } else {
                    // 容错：如果找不到 .wav.srt，尝试直接找 .srt (防止 Whisper 版本差异)
                    if (fs.existsSync(targetSrtPath)) {
                      const content = fs.readFileSync(targetSrtPath, "utf-8");
                      resolve();
                    } else {
                      throw new Error(
                        `Generated SRT file not found at: ${defaultGeneratedPath}`
                      );
                    }
                  }
                } catch (error) {
                  console.error("❌ Process SRT error:", error);
                  this.sendProgress(taskId, {
                    status: "error",
                    progress: 1,
                    error: "Failed to process result file",
                  });
                  // 这里不要 reject，否则前端收不到 error 状态
                  resolve();
                }
              }, 1000);
            } else {
              const errorMsg = `Whisper segment ${i + 1} failed with code ${code}`;
              console.error("❌", errorMsg);
              this.sendProgress(taskId, {
                status: "error",
                progress: 1.0,
                error: errorMsg,
              });
              resolve();
            }
          });
        });
      }

      console.log("✅ All segments completed successfully");
      this.sendProgress(taskId, { status: "completed", progress: 1.0 });
    } catch (error) {
      console.error("❌ Error running Whisper segments:", error);
      this.sendProgress(taskId, {
        status: "error",
        progress: 0,
        error: (error as Error).message,
      });
      throw error;
    }
  }
}
