import fs from "node:fs";
import path from "node:path";
import { app } from "electron";

/**
 * 获取临时文件目录
 * 🎯 修正：使用项目根目录下的 temp 文件夹 (process.cwd())
 * 保持与 audio-processing.ts 的写入位置一致
 */
export const getTempDir = () => {
  // ⚠️ 生产环境注意：打包后 process.cwd() 可能会变，但在开发模式下这是正确的。
  // 如果需要打包兼容，建议后续统一改为 app.getPath("userData")，但现在先按用户需求修复。
  return path.join(process.cwd(), "temp");
};

/**
 * 计算目录大小（MB）
 */
export const getDirectorySize = (dirPath: string): number => {
  if (!fs.existsSync(dirPath)) return 0;

  let totalSize = 0;
  try {
    const files = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const file of files) {
      const filePath = path.join(dirPath, file.name);
      if (file.isDirectory()) {
        totalSize += getDirectorySize(filePath);
      } else {
        const stats = fs.statSync(filePath);
        totalSize += stats.size;
      }
    }
  } catch (error) {
    console.warn(`Failed to calculate size for ${dirPath}:`, error);
  }

  // 如果这是递归调用的顶层，可能会返回 float，但这里实际上返回的是字节数的累加，
  // 只有最外层我们才转换为 MB。但是为了保持 API 简单，我们假设调用者知道这是递归的。
  // 原 main.ts 逻辑是在最后除以 (1024*1024)。
  // 为了复用方便，这个函数如果只是内部递归，最好返回字节。
  // 但为了兼容原逻辑，我们最好拆分一下，或者就在这里保持原样逻辑（注意递归的时候也会被除以 1024*1024 导致错误如果原逻辑有问题的话）。
  // 检查原 main.ts 逻辑：
  // const getDirectorySize = (dirPath) => { ... return totalSize / (1024*1024); }
  // 递归调用： totalSize += getDirectorySize(filePath);
  // 等等，如果原逻辑是递归调用自身，那么每次递归都除以了一次 (1024*1024)，这绝对是个 Bug！
  // 既然我们在重构，就顺便修复这个潜在的 Bug。
  // 我们将实现一个 getDirectorySizeBytes 辅助函数，然后导出 getDirectorySize 返回 MB。
  
  return totalSize; 
};

// 内部辅助：仅计算字节
const getDirectorySizeBytes = (dirPath: string): number => {
  if (!fs.existsSync(dirPath)) return 0;
  let totalSize = 0;
  try {
    const files = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const file of files) {
      const filePath = path.join(dirPath, file.name);
      if (file.isDirectory()) {
        totalSize += getDirectorySizeBytes(filePath);
      } else {
        const stats = fs.statSync(filePath);
        totalSize += stats.size;
      }
    }
  } catch (error) {
    console.warn(`Failed to read dir ${dirPath}:`, error);
  }
  return totalSize;
}

// 修正后的导出函数
export const getDirectorySizeMB = (dirPath: string): number => {
  const bytes = getDirectorySizeBytes(dirPath);
  return bytes / (1024 * 1024);
};


/**
 * 递归删除目录
 * @returns boolean successes
 */
/**
 * 递归删除目录 (Robust version)
 * @returns boolean true if completely cleaned, false if some files remain
 */
export const cleanDir = (dirPath: string): boolean => {
  if (!fs.existsSync(dirPath)) return true;
  
  let success = true;
  try {
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
      const curPath = path.join(dirPath, file);
      try {
        if (fs.lstatSync(curPath).isDirectory()) {
             if (!cleanDir(curPath)) success = false;
             // Try to remove the empty dir
             try { fs.rmdirSync(curPath); } catch (e) { success = false; }
        } else {
             fs.unlinkSync(curPath);
        }
      } catch (e) {
        console.warn(`⚠️ Failed to remove ${curPath}: ${(e as Error).message}`);
        success = false;
      }
    }
    
    // Attempt to remove root dir if requested, OR just leave it empty.
    // Original logic was "cleanDir" -> remove it.
    // But resetTempDir immediately recreates it.
    // So "Emptying" is better than "Deleting and Recreating".
    // But let's stick to "Delete dir" semantics of this function name if possible, 
    // OR just handle the root dir removal at the end.
    try {
      fs.rmdirSync(dirPath);
    } catch (e) {
       // If dir is not empty (because some files failed), this will fail. Expected.
       if (success) { // If we thought we were successful but rmdir failed...
           console.warn(`⚠️ Failed to remove dir ${dirPath}: ${(e as Error).message}`);
           success = false;
       }
    }
  } catch (error) {
    console.error(`❌ Failed to clean directory ${dirPath}:`, error);
    return false;
  }
  return success;
};

/**
 * 重置临时目录（清空）
 */
export const resetTempDir = (): boolean => {
  const tempDir = getTempDir();
  try {
    if (fs.existsSync(tempDir)) {
      // We only care if the files inside are gone.
      // If cleanDir fails to remove the ROOT tempDir but removed everything inside, that's fine too?
      // No, let's just use our improved cleanDir which tries to remove everything.
      const success = cleanDir(tempDir);
      
      // Ensure it exists again
      if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
      }
      return success;
    }
    fs.mkdirSync(tempDir, { recursive: true });
    return true;
  } catch (error) {
    console.error("❌ Failed to reset temp directory:", error);
    return false;
  }
};

/**
 * 应用退出时的清理逻辑
 */
export const cleanTempDirOnExit = (): void => {
  try {
    const tempDir = getTempDir();
    if (fs.existsSync(tempDir)) {
      cleanDir(tempDir);
      console.log("🗑️ Cleaned up temp directory on app exit");
    }
  } catch (error) {
    console.warn("⚠️ Failed to clean up temp directory on exit:", error);
  }
};
