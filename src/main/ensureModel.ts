import fs from "node:fs";
import path from "node:path";
import axios from "axios";
import { app } from "electron";

// 最小体积阈值 - Whisper models
const MIN_SIZES: Record<string, number> = {
  base: 130 * 1024 * 1024,
  small: 450 * 1024 * 1024,
  medium: 1400 * 1024 * 1024
};

// GGUF LLM模型配置
export const GGUF_MODELS = {
  'gemma2-2b': {
    url: 'https://huggingface.co/bartowski/gemma-2-2b-it-GGUF/resolve/main/gemma-2-2b-it-Q4_K_M.gguf',
    filename: 'gemma-2-2b-it-Q4_K_M.gguf',
    minSize: 1.5 * 1024 * 1024 * 1024 // ~1.6GB
  }
};

const getResourcesPath = () => {
  return app.isPackaged
    ? path.join(process.resourcesPath, "models")
    : path.join(process.cwd(), "resources", "models");
};

export const getModelPath = (modelName: string) => {
  // 如果是 Whisper 模型 (base/small/medium)
  if (['base', 'small', 'medium'].includes(modelName)) {
    return path.join(getResourcesPath(), `ggml-${modelName}.bin`);
  }
  
  // 如果是 LLM 模型
  if (GGUF_MODELS[modelName as keyof typeof GGUF_MODELS]) {
    return path.join(getResourcesPath(), GGUF_MODELS[modelName as keyof typeof GGUF_MODELS].filename);
  }
  
  // 默认返回
  return path.join(getResourcesPath(), modelName);
};

export const checkModelExists = (modelName: string): boolean => {
  const name = modelName.toLowerCase();
  const modelPath = getModelPath(name);
  
  if (fs.existsSync(modelPath)) {
    try {
      const stats = fs.statSync(modelPath);
      
      // 确定最小大小阈值
      let minSize = 100 * 1024 * 1024; // 默认100MB
      
      if (MIN_SIZES[name]) {
        // Whisper 模型
        minSize = MIN_SIZES[name];
      } else if (GGUF_MODELS[name as keyof typeof GGUF_MODELS]) {
        // GGUF 模型
        minSize = GGUF_MODELS[name as keyof typeof GGUF_MODELS].minSize;
      }
      
      if (stats.size < minSize) {
        console.warn(`⚠️ Model corrupted (size: ${stats.size}, expected: ${minSize}). Deleting: ${modelPath}`);
        fs.unlinkSync(modelPath);
        return false;
      }
      return true;
    } catch (e) {
      return false;
    }
  }
  return false;
};

export const ensureModel = async (
  modelName = "small",
  onProgress?: (progress: number) => void
): Promise<boolean> => {
  try {
    const name = modelName.toLowerCase();
    
    // 检查模型是否已存在
    if (checkModelExists(name)) {
      if (onProgress) onProgress(100);
      return true;
    }
    
    const modelPath = getModelPath(name);
    const modelDir = path.dirname(modelPath);
    await fs.promises.mkdir(modelDir, { recursive: true });

    // 确定下载 URL
    let downloadUrl = "";
    
    if (GGUF_MODELS[name as keyof typeof GGUF_MODELS]) {
      // LLM 模型下载
      downloadUrl = GGUF_MODELS[name as keyof typeof GGUF_MODELS].url;
      console.log(`⬇️ Downloading LLM model ${name} from ${downloadUrl}`);
    } else {
      // Whisper 模型下载
      downloadUrl = `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-${name}.bin`;
      console.log(`⬇️ Downloading Whisper model ${name} from ${downloadUrl}`);
    }

    const response = await axios({
      method: "GET",
      url: downloadUrl,
      responseType: "stream",
      onDownloadProgress: (p) => {
        if (p.total && onProgress) {
          onProgress(Math.round((p.loaded / p.total) * 100));
        }
      }
    });
    
    const writer = fs.createWriteStream(modelPath);
    response.data.pipe(writer);
    
    return new Promise((resolve, reject) => {
      writer.on("finish", () => {
        if (checkModelExists(name)) {
          console.log(`✅ Model ${name} downloaded successfully`);
          resolve(true);
        } else {
          reject(new Error("Download corrupted"));
        }
      });
      writer.on("error", reject);
    });
  } catch (e) {
    console.error("Ensure model failed:", e);
    return false;
  }
};
