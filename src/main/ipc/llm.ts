import { ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import https from 'https';
import { LLMService } from '../services/llm-service';

// 🔒 强制路径：项目根目录/resources/models
function getProjectModelPath() {
  // 🔒 强制锁定：项目根目录/resources/models/gemma-2-2b-it.Q4_K_M.gguf
  return path.join(process.cwd(), "resources", "models", "gemma-2-2b-it.Q4_K_M.gguf");
}

// 🔄 支持重定向的下载函数
function downloadFile(url: string, dest: string, onProgress?: (percent: number) => void): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    
    const request = https.get(url, (response) => {
      // ✨ 处理 302/301 重定向
      if (response.statusCode === 302 || response.statusCode === 301) {
        const newUrl = response.headers.location;
        if (!newUrl) return reject(new Error("Redirect location missing"));
        console.log("🔀 Following redirect to:", newUrl);
        file.close();
        // 递归调用
        downloadFile(newUrl, dest, onProgress).then(resolve).catch(reject);
        return;
      }
      
      if (response.statusCode !== 200) {
        file.close();
        fs.unlink(dest, () => {}); 
        return reject(new Error(`HTTP Error: ${response.statusCode}`));
      }
      
      const totalSize = parseInt(response.headers['content-length'] || '0', 10);
      let downloaded = 0;
      
      response.on('data', (chunk) => {
        downloaded += chunk.length;
        if (totalSize > 0 && onProgress) {
          onProgress(Math.round((downloaded / totalSize) * 100));
        }
      });
      
      response.pipe(file);
      file.on('finish', () => {
        file.close(() => {
          console.log("✅ Download finished:", dest);
          resolve(true);
        });
      });
    });
    
    request.on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

export function registerLLMHandlers() {
  // 1. 检查模型状态
  ipcMain.handle('llm-check-model', async () => {
    const p = getProjectModelPath();
    const exists = fs.existsSync(p);
    console.log(`🔍 Checking Model at [${p}]: ${exists ? "✅ Found" : "❌ Missing"}`);
    return exists;
  });

  // 2. 下载模型
  ipcMain.handle('llm-download-model', async (event) => {
    const targetPath = getProjectModelPath();
    const dir = path.dirname(targetPath);
    
    if (!fs.existsSync(dir)) {
      console.log("📂 Creating directory:", dir);
      fs.mkdirSync(dir, { recursive: true });
    }
    
    if (fs.existsSync(targetPath)) {
      console.log("✅ Model already exists, skipping download.");
      return true;
    }
    
    const modelUrl = "https://huggingface.co/bartowski/gemma-2-2b-it-GGUF/resolve/main/gemma-2-2b-it-Q4_K_M.gguf?download=true";
    console.log("⬇️ Starting download to:", targetPath);
    
    return await downloadFile(modelUrl, targetPath, (percent) => {
      // 可选：发送进度给前端
      // event.sender.send('download-progress', percent);
    });
  });

  // 3. 解释单词
  ipcMain.handle('explain-word', async (_, { word, sentence }) => {
    return await LLMService.getInstance().explainWordInContext(word, sentence);
  });

  // 4. 批量翻译
  ipcMain.handle('batch-translate', async (_, sentences) => {
    try {
      return await LLMService.getInstance().translateBatch(sentences);
    } catch (e: any) {
      return sentences.map(() => "[Error]");
    }
  });

  // 5. 手动导入模型
  ipcMain.handle('llm-import-local-model', async () => {
    const targetPath = getProjectModelPath();
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    // 打开文件选择框
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: '选择 GGUF 模型文件',
      filters: [{ name: 'Model Files', extensions: ['gguf', 'bin'] }],
      properties: ['openFile']
    });
    
    if (canceled || filePaths.length === 0) return false;
    
    const sourcePath = filePaths[0];
    console.log(`📦 Importing model from: ${sourcePath}`);
    
    try {
      // 复制文件到目标位置 (覆盖旧的)
      fs.copyFileSync(sourcePath, targetPath);
      console.log(`✅ Model imported to: ${targetPath}`);
      return true;
    } catch (e) {
      console.error("Import failed:", e);
      throw e;
    }
  });
}
