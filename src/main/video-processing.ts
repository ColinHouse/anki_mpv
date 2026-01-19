import { ipcMain } from "electron";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import path from "path";
import fs from "fs";
import { getTempDir } from "./utils/file-utils";

// 设置 ffmpeg 路径
ffmpeg.setFfmpegPath(ffmpegStatic);

interface TrimVideoResult {
  success: boolean;
  outputPath?: string;
  error?: string;
}

/**
 * 裁剪视频文件
 * @param inputPath 输入视频路径
 * @param startTime 开始时间（秒）
 * @param endTime 结束时间（秒），可选
 * @returns 裁剪结果
 */
export function trimVideo(inputPath: string, startTime: number, endTime?: number): Promise<TrimVideoResult> {
  return new Promise((resolve, reject) => {
    try {
      // 验证参数
      if (!inputPath || !fs.existsSync(inputPath)) {
        return resolve({
          success: false,
          error: "输入文件不存在"
        });
      }

      // ✅ 严格验证 startTime 是数字且非负
      if (typeof startTime !== 'number' || isNaN(startTime) || startTime < 0) {
        return resolve({
          success: false,
          error: `开始时间无效: ${startTime}`
        });
      }

      // ✅ 如果提供了 endTime，验证它是数字且大于 startTime
      if (endTime !== undefined) {
        if (typeof endTime !== 'number' || isNaN(endTime) || endTime <= startTime) {
          return resolve({
            success: false,
            error: `结束时间无效: ${endTime} (必须大于开始时间 ${startTime})`
          });
        }
      }

      // 确保 temp 目录存在
      const tempDir = getTempDir();
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // 生成输出文件路径
      const fileName = `trimmed_${Date.now()}_${path.basename(inputPath)}`;
      const outputPath = path.join(tempDir, fileName);

      console.log(`开始裁剪视频: ${inputPath}`);
      console.log(`时间范围: ${startTime}s - ${endTime !== undefined ? endTime + 's' : '结尾'}`);
      console.log(`输出路径: ${outputPath}`);

      // 使用 ffmpeg 裁剪视频
      let command = ffmpeg(inputPath);
      
      // 设置开始时间
      if (startTime > 0) {
        command = command.setStartTime(startTime);
      }
      
      // 设置持续时间（如果提供了 endTime）
      if (endTime !== undefined) {
        command = command.setDuration(endTime - startTime);
      }
      
      command
        .outputOptions('-c copy') // 启用流拷贝模式，避免重新编码
        .output(outputPath)
        .on("start", (commandLine) => {
          console.log("FFmpeg 命令:", commandLine);
        })
        .on("progress", (progress) => {
          if (progress.percent) {
            console.log(`裁剪进度: ${progress.percent.toFixed(1)}%`);
          }
        })
        .on("end", () => {
          console.log("视频裁剪完成:", outputPath);
          
          if (fs.existsSync(outputPath)) {
            resolve({
              success: true,
              outputPath: outputPath
            });
          } else {
            resolve({
              success: false,
              error: "裁剪完成但输出文件不存在"
            });
          }
        })
        .on("error", (err) => {
          console.error("视频裁剪失败:", err);
          resolve({
            success: false,
            error: err.message
          });
        })
        .run();
    } catch (error) {
      console.error("裁剪视频时发生错误:", error);
      resolve({
        success: false,
        error: (error as Error).message
      });
    }
  });
}

/**
 * 注册 IPC 处理器
 */
export function registerVideoProcessingHandlers() {
  ipcMain.handle("trim-video", async (event, args) => {
    try {
      // 1. 调试日志：查看接收到的完整对象
      console.log('📦 IPC trim-video 接收参数:', JSON.stringify(args, null, 2));
      
      // 2. 解构参数
      const { filePath, startTime, endTime } = args;
      
      // 3. 参数校验
      if (!filePath) {
        throw new Error(`文件路径缺失。接收到: ${JSON.stringify(args)}`);
      }
      
      if (startTime === undefined || startTime === null) {
        throw new Error(`开始时间缺失。接收到: ${JSON.stringify(args)}`);
      }
      
      console.log(`✅ 解构后参数: filePath=${filePath}, startTime=${startTime}, endTime=${endTime}`);
      
      // 4. 调用业务逻辑
      const result = await trimVideo(filePath, startTime, endTime);
      return result;
    } catch (error) {
      console.error("❌ IPC 处理 trim-video 失败:", error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  });
}
