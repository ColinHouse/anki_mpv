import fs from "node:fs";
import path from "node:path";
import axios from "axios";
import { app } from "electron";

const LEGACY_LOCAL_STT_MODELS = new Set(["base", "small", "medium"]);

type ProgressCallback = (progress: number) => void;

type ActiveDownload = {
  promise: Promise<boolean>;
  progressCallbacks: Set<ProgressCallback>;
};

const activeDownloads = new Map<string, ActiveDownload>();

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
  // Legacy local STT model path. These models are no longer used by the default app flow.
  if (LEGACY_LOCAL_STT_MODELS.has(modelName)) {
    return path.join(getResourcesPath(), `ggml-${modelName}.bin`);
  }
  
  // 如果是 LLM 模型
  if (GGUF_MODELS[modelName as keyof typeof GGUF_MODELS]) {
    return path.join(getResourcesPath(), GGUF_MODELS[modelName as keyof typeof GGUF_MODELS].filename);
  }
  
  // 默认返回
  return path.join(getResourcesPath(), modelName);
};

const getMinimumModelSize = (name: string): number => {
  if (GGUF_MODELS[name as keyof typeof GGUF_MODELS]) {
    return GGUF_MODELS[name as keyof typeof GGUF_MODELS].minSize;
  }

  return 100 * 1024 * 1024;
};

export const checkModelExists = (modelName: string): boolean => {
  const name = modelName.toLowerCase();
  const modelPath = getModelPath(name);

  if (LEGACY_LOCAL_STT_MODELS.has(name)) {
    return false;
  }
  
  if (fs.existsSync(modelPath)) {
    try {
      const stats = fs.statSync(modelPath);
      
      const minSize = getMinimumModelSize(name);
      
      if (stats.size < minSize) {
        console.warn(`⚠️ Model incomplete (size: ${stats.size}, expected: ${minSize}): ${modelPath}`);
        return false;
      }
      return true;
    } catch (e) {
      return false;
    }
  }
  return false;
};

const notifyProgress = (download: ActiveDownload, progress: number) => {
  for (const callback of download.progressCallbacks) {
    try {
      callback(progress);
    } catch (error) {
      console.warn("Model progress callback failed:", error);
    }
  }
};

const downloadModel = async (name: string, download: ActiveDownload): Promise<boolean> => {
  const modelPath = getModelPath(name);
  const modelDir = path.dirname(modelPath);
  const tempPath = `${modelPath}.download`;
  await fs.promises.mkdir(modelDir, { recursive: true });
  await fs.promises.rm(tempPath, { force: true });

  // 确定下载 URL
  let downloadUrl = "";
  
  if (!GGUF_MODELS[name as keyof typeof GGUF_MODELS]) {
    throw new Error(`No downloadable local model is configured for ${name}.`);
  }

  // LLM 模型下载
  downloadUrl = GGUF_MODELS[name as keyof typeof GGUF_MODELS].url;
  console.log(`⬇️ Downloading LLM model ${name} from ${downloadUrl}`);

  try {
    const response = await axios({
      method: "GET",
      url: downloadUrl,
      responseType: "stream",
      onDownloadProgress: (p) => {
        if (p.total) {
          notifyProgress(download, Math.round((p.loaded / p.total) * 100));
        }
      }
    });
    
    const writer = fs.createWriteStream(tempPath);
    response.data.pipe(writer);
    
    await new Promise<void>((resolve, reject) => {
      response.data.on("error", reject);
      writer.on("finish", resolve);
      writer.on("error", reject);
    });

    const stats = await fs.promises.stat(tempPath);
    const minSize = getMinimumModelSize(name);
    if (stats.size < minSize) {
      throw new Error(`Download incomplete: ${stats.size} bytes, expected at least ${minSize}`);
    }

    await fs.promises.rm(modelPath, { force: true });
    await fs.promises.rename(tempPath, modelPath);

    notifyProgress(download, 100);
    console.log(`✅ Model ${name} downloaded successfully`);
    return true;
  } catch (error) {
    await fs.promises.rm(tempPath, { force: true }).catch((): undefined => undefined);
    throw error;
  }
};

export const ensureModel = async (
  modelName = "small",
  onProgress?: ProgressCallback
): Promise<boolean> => {
  try {
    const name = modelName.toLowerCase();

    if (LEGACY_LOCAL_STT_MODELS.has(name)) {
      console.info("Local speech models are deprecated in the default workflow.");
      return false;
    }

    const activeDownload = activeDownloads.get(name);
    if (activeDownload) {
      if (onProgress) {
        activeDownload.progressCallbacks.add(onProgress);
      }
      return activeDownload.promise;
    }
    
    // 检查模型是否已存在
    if (checkModelExists(name)) {
      if (onProgress) onProgress(100);
      return true;
    }

    const download: ActiveDownload = {
      promise: Promise.resolve(false),
      progressCallbacks: new Set<ProgressCallback>(),
    };

    if (onProgress) {
      download.progressCallbacks.add(onProgress);
    }

    download.promise = downloadModel(name, download).finally(() => {
      activeDownloads.delete(name);
    });
    activeDownloads.set(name, download);

    return download.promise;
  } catch (e) {
    console.error("Ensure model failed:", e);
    return false;
  }
};
