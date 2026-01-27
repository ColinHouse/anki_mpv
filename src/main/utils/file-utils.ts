import fs from "node:fs";
import path from "node:path";

/**
 * 获取临时文件目录
 * 🎯 修正：使用项目根目录下的 temp 文件夹 (process.cwd())
 * 保持与 audio-processing.ts 的写入位置一致
 */

export const getTempDir = function () {
  // ⚠️ 生产环境注意：打包后 process.cwd() 可能会变。
  return path.join(process.cwd(), "temp");
};

/**
 * 计算目录大小（MB）
 */
// export const getDirectorySize = function (dirPath: string): number {
//   if (!fs.existsSync(dirPath)) return 0;

//   let totalSize = 0;
//   try {
//     const files = fs.readdirSync(dirPath, { withFileTypes: true });

//     for (const file of files) {
//       const filePath = path.join(dirPath, file.name);
//       if (file.isDirectory()) {
//         totalSize += getDirectorySize(filePath);
//       } else {
//         const stats = fs.statSync(filePath);
//         totalSize += stats.size;
//       }
//     }
//   } catch (error) {
//     console.warn(`Failed to calculate size for ${dirPath}:`, error);
//   }

//   return totalSize;
// };

// 内部辅助：仅计算字节
const getDirectorySizeBytes = function (dirPath: string): number {
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
};

// 修正后的导出函数
export const getDirectorySizeMB = function (dirPath: string): number {
  const bytes = getDirectorySizeBytes(dirPath);
  return bytes / (1024 * 1024);
};

/**
 * 递归删除目录 (Robust version)
 * @returns boolean true if completely cleaned, false if some files remain
 */
export const cleanDir = function (dirPath: string): boolean {
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
          try {
            fs.rmdirSync(curPath);
          } catch (e) {
            success = false;
          }
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
      if (success) {
        // If we thought we were successful but rmdir failed...
        console.warn(
          `⚠️ Failed to remove dir ${dirPath}: ${(e as Error).message}`,
        );
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
export const resetTempDir = function (): boolean {
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
export const cleanTempDirOnExit = function (): void {
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
