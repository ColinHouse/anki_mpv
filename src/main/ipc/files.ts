import { ipcMain, dialog } from "electron";
import fs from "node:fs";
import { readSettings, writeSettings } from "../services/settings";
import { StreamingServer } from "../services/server";
import { resetTempDir, getDirectorySizeMB, getTempDir } from "../utils/file-utils";

export const registerFileHandlers = () => {
  console.log("📂 Registering file handlers...");

  // IPC handler for file dialog
  ipcMain.handle("open-file-dialog", async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ["openFile"],
        filters: [
          { name: "Video Files", extensions: ["mp4", "mkv", "avi"] },
          { name: "All Files", extensions: ["*"] },
        ],
      });

      // Return the selected file path or null if cancelled
      return result.canceled ? null : result.filePaths[0];
    } catch (error) {
      console.error("Error opening file dialog:", error);
      return null;
    }
  });

  // IPC handler for multi-file dialog (Batch Queue)
  ipcMain.handle("open-file-dialog-multi", async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ["openFile", "multiSelections"],
        filters: [
          { name: "Video Files", extensions: ["mp4", "mkv", "avi"] },
          { name: "All Files", extensions: ["*"] },
        ],
      });

      // Return array of file paths or null
      return result.canceled ? null : result.filePaths;
    } catch (error) {
      console.error("Error opening multi-file dialog:", error);
      return null;
    }
  });

  // ✅ IPC handler for directory dialog (Output Directory Selection)
  ipcMain.handle("open-directory-dialog", async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ["openDirectory"],
        title: "选择识别结果保存目录",
      });
      
      console.log('📁 Directory dialog result:', result);
      
      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        return { canceled: true, filePaths: [] };
      }
      
      return { canceled: false, filePaths: result.filePaths };
    } catch (error) {
      console.error("❌ Error opening directory dialog:", error);
      return { canceled: true, filePaths: [], error: (error as Error).message };
    }
  });

  // ✅ IPC handler to check if a file exists (used by batch trim validation)
  ipcMain.handle("check-file-exists", async (_event, filePath: string) => {
    try {
      if (!filePath) return false;
      return fs.existsSync(filePath);
    } catch (error) {
      console.error("❌ Error checking file existence:", error);
      return false;
    }
  });

  // 保存文件（直接保存，不弹窗）
  ipcMain.handle("save-file-direct", async (_event, { path: savePath, content }: { path: string; content: string }) => {
    try {
      fs.writeFileSync(savePath, content, "utf8");
      return { success: true, path: savePath };
    } catch (error) {
      console.error("Failed to save file:", error);
      return { success: false, error: (error as Error).message };
    }
  });

  // 注册 IPC Handlers
  // get-settings: 读取并返回 JSON 内容
  ipcMain.handle("get-settings", async () => {
    return readSettings();
  });

  // save-settings: 接收对象并写入 JSON 文件
  ipcMain.handle("save-settings", async (_event, settings) => {
    return writeSettings(settings);
  });

  // IPC handler for video server URL (Actually returns port now based on refactor plan)
  // Wait, the prompt says "get-server-port", main.ts has "get-server-port" returning port.
  // main.ts also had "get-video-server-url" calling videoServerManager.getServerUrl().
  // The plan Step 4.5 says "Migrate server port handler".
  // Looking at main.ts code viewed previously:
  // ipcMain.handle("get-server-port", () => StreamingServer.getInstance().getPort());
  // There is also `ipcMain.handle("get-video-server-url", ...)` which uses `videoServerManager`.
  // I should migrate `get-server-port` as requested. 
  // I will check if `get-video-server-url` is still needed or if it belongs here. 
  // The Prompt 4.5 specifically mentions "from main.ts cut get-server-port IPC". It doesn't mention get-video-server-url.
  // I will only migrate `get-server-port`.

  ipcMain.handle("get-server-port", async () => {
    return StreamingServer.getInstance().getPort();
  });

  // clear-temp-dir: 重置临时目录
  ipcMain.handle("clear-temp-dir", async () => {
    return resetTempDir();
  });

  // get-temp-size: 计算 temp 目录的总大小并返回（MB）
  ipcMain.handle("get-temp-size", async () => {
    try {
      const sizeMB = getDirectorySizeMB(getTempDir());
      return sizeMB;
    } catch (error) {
      console.error("Error getting temp directory size:", error);
      return 0;
    }
  });

  // IPC handler for importing SRT files
  ipcMain.handle("import-srt", async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ["openFile"],
        filters: [
          { name: "Subtitle Files", extensions: ["srt"] },
          { name: "All Files", extensions: ["*"] },
        ],
      });

      // Return null if cancelled
      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, error: "用户取消选择" };
      }

      const filePath = result.filePaths[0];

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        return { success: false, error: "文件不存在" };
      }

      // Read file content with proper encoding handling
      const content = fs.readFileSync(filePath, "utf-8");

      if (!content || content.trim().length === 0) {
        return { success: false, error: "文件内容为空" };
      }

      console.log(`✅ Successfully imported SRT file: ${filePath}`);
      return { success: true, content };
    } catch (error) {
      console.error("❌ Error importing SRT file:", error);
      return { success: false, error: (error as Error).message };
    }
  });

  // IPC handler for exporting subtitles as SRT file
  ipcMain.handle("export-srt", async (_event, content: string) => {
    try {
      const result = await dialog.showSaveDialog({
        title: "导出字幕",
        defaultPath: "subtitle.srt",
        filters: [{ name: "Subtitles", extensions: ["srt"] }],
      });

      if (result.filePath && !result.canceled) {
        fs.writeFileSync(result.filePath, content, "utf-8");
        console.log(`✅ Subtitle exported to: ${result.filePath}`);
        return { success: true };
      }
      
      return { success: false, error: "用户取消保存" };
    } catch (error) {
      console.error("❌ Export failed:", error);
      return { success: false, error: (error as Error).message };
    }
  });
};
