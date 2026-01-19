import { app } from "electron";
import fs from "node:fs";
import path from "node:path";

// 设置存储：在 app.getPath('userData') 下创建一个 settings.json 文件用于持久化配置
const SETTINGS_PATH = path.join(app.getPath("userData"), "settings.json");

// 获取默认设置
export const getDefaultSettings = () => ({
  activeModel: "small",
  llmUrl: "http://localhost:11434"
});

// 读取设置
export const readSettings = () => {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      const content = fs.readFileSync(SETTINGS_PATH, "utf8");
      return JSON.parse(content);
    }
  } catch (error) {
    console.warn("⚠️ Failed to read settings:", error);
  }
  return getDefaultSettings();
};

// 写入设置
export const writeSettings = (settings: any) => {
  try {
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
    return true;
  } catch (error) {
    console.error("❌ Failed to write settings:", error);
    return false;
  }
};
