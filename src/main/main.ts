declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

import { app, BrowserWindow, ipcMain, protocol } from "electron";
import fs from "node:fs";
import path from "node:path";
import started from "electron-squirrel-startup";

import { extractAudio } from "./audio-processing";

import { StreamingServer } from "./services/server";
import { SegmentationService } from "./services/segmentation-service";

import { cleanTempDirOnExit } from "./utils/file-utils";

import { registerFileHandlers } from "./ipc/files";
import { registerSegmentationHandlers } from "./ipc/segmentation";
import { registerLLMHandlers } from "./ipc/llm";
import { registerDictionaryHandlers } from "./ipc/dictionary";
import { registerAnkiHandlers } from "./ipc/anki";
import { registerMediaHandlers } from "./ipc/media";
import { registerTranscriptionHandlers } from "./ipc/transcription";

import { AnkiService } from "./services/anki-service";

// 1. 注册特权协议 (必须放在 app.ready 之前)
protocol.registerSchemesAsPrivileged([
  {
    scheme: "media",
    privileges: {
      secure: true,
      supportFetchAPI: true,
      bypassCSP: true, // <--- 关键：绕过内容安全策略
      stream: true, // <--- 关键：支持视频流
      corsEnabled: true, // <--- 关键：允许跨域（虽然这里是本地）
    },
  },
]);

// 在 Windows 系统上安装/卸载时处理创建/删除快捷方式的操作
// 标准起手式
if (started) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false, // 💡 去掉原生标题栏
    transparent: true, // 💡 允许透明
    backgroundColor: "#00000000", // 💡 背景全透明
    vibrancy: "under-window", // macOS 特效（模糊、毛玻璃）
    visualEffectState: "active",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      webSecurity: false, // 开发阶段暂时关掉它，排除 CSP 干扰
    },
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    // MAIN_WINDOW_VITE_DEV_SERVER_URL 有值 → 开发环境
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
      // 没有值 → 生产环境
    );
  }

  // Open the DevTools.
  // mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// macOS 特有行为
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// 应用退出时清理临时文件
app.on("will-quit", () => {
  cleanTempDirOnExit();
});

// 导入视频处理模块
import { registerVideoProcessingHandlers } from "./video-processing";

// 引入依赖
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";

// 设置 ffmpeg 路径
ffmpeg.setFfmpegPath(ffmpegStatic);

// IPC handler for file dialog
// Migrated to src/main/ipc/files.ts

// _event → Main 事件对象（没用，用 _ 忽略）
// videoPath → 视频路径
// startTime / duration → 可选裁剪参数
// Frontend: const result = await ipcRenderer.invoke("extract-audio", "/path/video.mp4", 0, 10);
ipcMain.handle(
  "extract-audio",
  async (_event, videoPath: string, startTime?: number, duration?: number) => {
    try {
      if (!videoPath) {
        return { success: false, error: "Missing video path" };
      }

      if (!fs.existsSync(videoPath)) {
        return { success: false, error: "Video file not found" };
      }

      const outputPath = await extractAudio(videoPath, startTime, duration);
      return { success: true, outputPath };
    } catch (error) {
      console.error("Error extracting audio:", error);
      return { success: false, error: (error as Error).message };
      // (error as Error).message 类型断言（type assertion）
    }
  },
);

// Deprecated local speech model IPC. The default workflow is provider-based
// transcription through imported subtitles, mock cloud, or future cloud ASR.
ipcMain.handle("ensure-model", async () => true);
ipcMain.handle("check-model-status", async () => false);
ipcMain.handle("download-model", async () => false);

// 注册 IPC Handlers
// Migrated to src/main/ipc/files.ts

// clear-temp-dir: 重置临时目录
// Migrated to src/main/ipc/files.ts

ipcMain.handle("run-whisper", async () => ({
  success: false,
  error: "Local Whisper transcription is deprecated. Use imported subtitles or Mock Cloud ASR.",
}));

ipcMain.handle("run-whisper-segments", async () => ({
  success: false,
  error: "Local Whisper transcription is deprecated. Use imported subtitles or Mock Cloud ASR.",
}));

ipcMain.handle("stop-whisper", async () => ({ success: true }));

ipcMain.handle("check-whisper-availability", async () => ({
  available: false,
  deprecated: true,
  error: "Local Whisper is no longer part of the default demo workflow.",
}));

// IPC handler for getting video information
ipcMain.handle("get-video-info", async (_event, filePath: string) => {
  try {
    if (!filePath) {
      return { error: "Missing file path" };
    }

    if (!fs.existsSync(filePath)) {
      return { error: "File not found" };
    }

    // 使用 fluent-ffmpeg 读取视频信息
    const metadata = await new Promise<any>((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          reject(err);
        } else {
          resolve(metadata);
        }
      });
    });

    const videoInfo = {
      duration: metadata.format.duration,
      format: metadata.format.format_name,
      size: metadata.format.size,
      bitrate: metadata.format.bit_rate,
      streams: metadata.streams.map((stream: any) => ({
        codec_name: stream.codec_name,
        codec_type: stream.codec_type,
        width: stream.width,
        height: stream.height,
        r_frame_rate: stream.r_frame_rate,
      })),
    };

    return videoInfo;
  } catch (error) {
    console.error("Error getting video info:", error);
    return { error: (error as Error).message };
  }
});

// Window Controls IPC
ipcMain.handle("window-min", () => {
  BrowserWindow.getAllWindows()[0]?.minimize();
});
ipcMain.handle("window-max", () => {
  const win = BrowserWindow.getAllWindows()[0];
  if (win) {
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  }
});
ipcMain.handle("window-close", () => {
  BrowserWindow.getAllWindows()[0]?.close();
});

// 启动本地流媒体服务器
app.whenReady().then(async () => {
  try {
    // 启动流媒体服务
    await StreamingServer.getInstance().init();

    // Initialize Kuromoji (Non-blocking as per recommendation)
    console.log("🌸 Initializing Kuromoji...");
    SegmentationService.getInstance()
      .init()
      .then(() => console.log("✅ Kuromoji initialized!"))
      .catch((e) => console.error("❌ Failed to initialize Kuromoji:", e));

    // Register Segmentation IPC Handlers
    registerSegmentationHandlers();

    // 4. 注册查词服务
    registerDictionaryHandlers();

    // 5. 注册 Anki 服务
    registerAnkiHandlers();

    // 🚀 尝试初始化 Anki（非阻塞，失败不影响启动）
    // 🚀 延迟 5 秒初始化 Anki，等待 Anki 启动或同步完成
    setTimeout(() => {
      AnkiService.getInstance()
        .initAnki()
        .then(() => console.log("✅ Anki initialized successfully (Lazy)"))
        .catch((e) =>
          console.warn(
            "⚠️ Anki auto-init skipped (App will try again when adding cards):",
            e.message,
          ),
        );
    }, 3000);

    // 6. 注册媒体处理服务
    registerMediaHandlers();

    // 注册文件相关 IPC Handlers
    registerFileHandlers();

    // 注册转写 Provider IPC Handlers
    registerTranscriptionHandlers();

    // 注册 LLM 相关 IPC Handlers
    registerLLMHandlers();

    // IPC 通信：返回服务器端口给渲染进程 - REMOVED (Duplicate of ipc/files.ts)
  } catch (error) {
    console.error("Error starting streaming server:", error);
  }

  // 【老兵不死方案】使用 registerFileProtocol 直接映射文件系统
  // 这种方式由 Chrome 内核直接处理 Range 请求，稳如老狗
  protocol.registerFileProtocol("media", (request, callback) => {
    // 1. 剥离前缀
    const url = request.url.replace("media://", "");

    // 2. 解码 (解决中文乱码)
    const decodedPath = decodeURIComponent(url);

    // 3. 处理 Windows 盘符兼容性 (例如 /F:/Video -> F:/Video)
    // 有些版本的 Electron 会带上前导斜杠，视情况去掉
    let finalPath = decodedPath;
    // 简单粗暴的正则：如果开头是 / 且后面跟着 盘符:，就去掉 /
    if (/^\/[a-zA-Z]:/.test(finalPath)) {
      finalPath = finalPath.substring(1);
    }

    // 4. 直接回调文件路径
    // Chrome 会自动处理 206 Partial Content、Content-Type 等所有头信息
    callback({ path: finalPath });
  });

  // 注册视频处理 IPC 处理器
  registerVideoProcessingHandlers();
});
