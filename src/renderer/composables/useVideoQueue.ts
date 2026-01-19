import { ref } from 'vue';
import { QueueItem } from '../types';

const videoQueue = ref<QueueItem[]>([]);
const isSidebarOpen = ref(true);
const outputDir = ref<string>('');
const selectedFile = ref<string | null>(null);
const selectedFilePath = ref<string | null>(null);
const currentVideoPath = ref<string | null>(null);

export function useVideoQueue() {
  const addVideosToQueue = async () => {
    const filePaths = await (window as any).api.invoke("open-file-dialog-multi");
    if (!filePaths || !Array.isArray(filePaths)) return;
    for (const path of filePaths) {
      if (videoQueue.value.some((v) => v.originalPath === path)) continue;
      videoQueue.value.push({
        id: globalThis.crypto.randomUUID(),
        path,
        originalPath: path,
        name: path.split(/[\\/]/).pop() || "Unknown",
        status: "pending",
      });
    }
  };

  const removeFromQueue = (id: string) => {
    videoQueue.value = videoQueue.value.filter((i) => i.id !== id);
  };

  const loadVideoFromQueue = async (item: QueueItem) => {
    selectedFilePath.value = item.path;
    currentVideoPath.value = item.path;
    selectedFile.value = item.name;
  };

  const getItemByPath = (path: string) => {
    return videoQueue.value.find(v => v.path === path);
  };

  // 选择输出目录
  const selectOutputDirectory = async (): Promise<string | null> => {
    try {
      const result = await (window as any).api.invoke('open-directory-dialog');
      if (result && !result.canceled && result.filePaths?.[0]) {
        outputDir.value = result.filePaths[0];
        console.log('📁 Output directory selected:', outputDir.value);
        return outputDir.value;
      }
      return null;
    } catch (error) {
      console.error('Failed to select directory:', error);
      return null;
    }
  };

  // 确保输出目录存在
  const ensureOutputDirectory = async (): Promise<boolean> => {
    if (outputDir.value) return true;
    
    const selected = await selectOutputDirectory();
    if (!selected) {
      alert('请选择输出目录以保存识别结果');
      return false;
    }
    return true;
  };

  return {
    videoQueue,
    isSidebarOpen,
    outputDir,
    selectedFile,
    selectedFilePath,
    currentVideoPath,
    addVideosToQueue,
    removeFromQueue,
    loadVideoFromQueue,
    getItemByPath,
    selectOutputDirectory,
    ensureOutputDirectory
  };
}
