import { ref, computed } from 'vue';
import { QueueItem, Subtitle, WhisperProgress } from '../types';
import { useVideoQueue } from './useVideoQueue';
import { parseSRT, generateSrtString } from '../utils/subtitle-utils';

// 🔴 关键：定义在函数外部，实现全局单例状态
const isRecognitionRunning = ref(false);
const recognitionProgress = ref(0);
const isWhisperAvailable = ref(false);
const isAutoBatchMode = ref(false);
const isPolishing = ref(false);
const autoProcessMode = ref<"none" | "translate">("translate");
const currentActiveTaskId = ref<string | null>(null);
const polishingIds = ref<Set<string>>(new Set());

const whisperStatus = ref<WhisperProgress>({
  status: "idle",
  progress: 0,
  error: "",
  currentSegment: 0,
  totalSegments: 0,
  overallProgress: 0,
});

const subtitles = ref<Subtitle[]>([]);

// 全局 callback 引用
let _globalLoadVideoCallback: ((item: QueueItem) => Promise<void>) | null = null;

export function useWhisper(loadVideoCallback?: (item: QueueItem) => Promise<void>) {
  const { videoQueue, outputDir, selectedFilePath, ensureOutputDirectory } = useVideoQueue();

  // 更新 callback
  if (loadVideoCallback) {
    _globalLoadVideoCallback = loadVideoCallback;
  }

  // 计算属性
  const isSystemBusy = computed(() => {
    return isRecognitionRunning.value || isAutoBatchMode.value;
  });

  const checkEnvironment = async () => {
    try {
      const modelResult = await (window as any).api.ensureModel();
      if (!modelResult) {
        alert("模型检查失败，请检查网络连接");
        isWhisperAvailable.value = false;
        return;
      }
      
      if (selectedFilePath.value) {
        const audioResult = await (window as any).api.extractAudio(
          selectedFilePath.value,
        );
        if (!audioResult?.success) {
          alert(`音频提取失败: ${audioResult?.error || "未知错误"}`);
        }
      }
      
      const whisperResult = await (window as any).api.checkWhisperAvailability();
      if (whisperResult?.available) {
        isWhisperAvailable.value = true;
      } else {
        isWhisperAvailable.value = false;
        alert(
          `Whisper不可用: ${whisperResult?.error || "请检查Whisper可执行文件"}`,
        );
      }
      console.log("✅ Environment check passed (Global)");
    } catch (error) {
      console.error("环境检查失败:", error);
      alert(`环境检查失败: ${(error as Error).message}`);
      isWhisperAvailable.value = false;
    }
  };

  const startRecognition = async () => {
    if (!selectedFilePath.value) {
      alert("请先选择视频文件");
      return;
    }
    if (!isWhisperAvailable.value) {
      alert("Whisper不可用，请先检查环境");
      return;
    }
  
    try {
      isRecognitionRunning.value = true;
      recognitionProgress.value = 0;
      subtitles.value = [];
      
      // ✅ Create Promise to wait for completion event
      const taskPromise = new Promise<any>((resolve, reject) => {
        const timeout = setTimeout(() => {
          cleanup();
          reject(new Error("识别超时（20分钟）"));
        }, 20 * 60 * 1000);
        
        const handler = (_event: any, data: any) => {
          const safeData = data || _event;
          if (!safeData || typeof safeData !== 'object') return;
          
          if (safeData.status === 'completed') {
            if (safeData.subtitles || safeData.srtContent) {
              cleanup();
              resolve(safeData);
            } else {
              console.warn("⚠️ Received empty 'completed' signal. Waiting for data payload...");
            }
          } else if (safeData.status === 'error') {
            cleanup();
            reject(new Error(safeData.error || '未知错误'));
          } else if (safeData.status === 'processing') {
            whisperStatus.value = safeData;
            recognitionProgress.value = (safeData.progress || 0) * 100;
          }
        };
        
        const cleanup = () => {
          clearTimeout(timeout);
          (window as any).api.removeListener('whisper-status', handler);
        };
        
        (window as any).api.on('whisper-status', handler);
      });
      
      // Send recognition request
      const result = await (window as any).api.runWhisper(selectedFilePath.value);
      if (!result.success) throw new Error(result.error);
      
      // Wait for completion event with subtitle data
      const resultData = await taskPromise;
      
      // 🟢【数据填充】
      if (resultData.subtitles && resultData.subtitles.length > 0) {
        subtitles.value = resultData.subtitles.map((sub: any, index: number) => ({
          id: `sub-${Date.now()}-${index}`,
          text: sub.text,
          startTime: sub.start,
          endTime: sub.end,
        }));
      } else if (resultData.srtContent) {
        const parsed = parseSRT(resultData.srtContent);
        if (parsed && parsed.length > 0) {
          subtitles.value = parsed;
        }
      }
      
      // 🟢【核心修复】批量模式下的保存逻辑
      if (isAutoBatchMode.value && outputDir.value) {
        const currentItem = videoQueue.value.find(v => v.path === selectedFilePath.value);
        
        if (currentItem) {
           if (!resultData.srtContent && (!subtitles.value || subtitles.value.length === 0)) {
             throw new Error("未获取到任何字幕数据");
           }
  
            const safeName = currentItem.name
              .replace(/[\\/:*?"<>|]/g, "_")
              .replace(/\.[^/.]+$/, "");
            const srtPath = `${outputDir.value}\\${safeName}.srt`;
            
            const contentToSave = resultData.srtContent || generateSrtString(subtitles.value);
            
            await (window as any).api.invoke('save-file-direct', { 
              path: srtPath, 
              content: contentToSave
            });
            
            currentItem.status = 'completed';
            console.log(`✅ Saved: ${srtPath}`);
         }
         
         setTimeout(triggerNextBatchItem, 1000);
      } else {
         if (subtitles.value.length === 0) {
            alert("识别完成，但生成的字幕为空。");
         } else {
            alert("语音识别完成！");
         }
      }
      
      whisperStatus.value = {
        status: "idle",
        progress: 0,
        error: "",
        currentSegment: 0,
        totalSegments: 0,
        overallProgress: 0,
      };
    } catch (error) {
      console.error("识别失败:", error);
      
      if (isAutoBatchMode.value) {
        const currentItem = videoQueue.value.find(v => v.path === selectedFilePath.value);
        if (currentItem) {
          currentItem.status = 'error';
        }
        
        alert(`处理失败: ${(error as Error).message}\n继续处理下一个...`);
        
        setTimeout(() => triggerNextBatchItem(), 1000); // Fixed explicit call
      } else {
        alert(`识别失败: ${(error as Error).message}`);
      }
    } finally {
      isRecognitionRunning.value = false;
    }
  };

  // ✅ 链式调度器：自动触发下一个待处理任务
  const triggerNextBatchItem = async () => {
    if (!isAutoBatchMode.value) return;
    
    // 查找第一个 pending 状态的项
    const nextItem = videoQueue.value.find(v => v.status === 'pending');
    
    if (!nextItem) {
      isAutoBatchMode.value = false;
      alert('🎉 所有批量任务已完成！');
      return;
    }
    
    try {
      // 加载视频 (using global callback)
      if (_globalLoadVideoCallback) {
        await _globalLoadVideoCallback(nextItem);
      } else {
        console.warn("Missing loadVideoCallback, cannot load video automatically.");
      }
      
      // 给 UI 一点刷新时间
      await new Promise(r => setTimeout(r, 1000));
      
      // 启动识别
      await startRecognition();
    } catch (error) {
      console.error('❌ 链式处理出错:', error);
      isAutoBatchMode.value = false;
      alert(`批量处理中断: ${(error as Error).message}`);
    }
  };

  // ✅ 开始批量处理（启动自动链）
  const startBatchProcessing = async () => {
    if (videoQueue.value.length === 0) {
      alert('队列为空，请先添加视频');
      return;
    }
  
    const pendingTasks = videoQueue.value.filter(v => v.status !== 'completed');
    
    if (pendingTasks.length === 0) {
      alert('所有任务已完成');
      return;
    }
  
    if (!confirm(`确定要自动识别列表中的所有待处理视频吗？（共 ${pendingTasks.length} 个）`)) {
      return;
    }
  
    const hasDir = await ensureOutputDirectory();
    if (!hasDir) return;
  
    isAutoBatchMode.value = true;
    triggerNextBatchItem();
  };

  return {
    isRecognitionRunning,
    recognitionProgress,
    whisperStatus,
    isWhisperAvailable,
    isAutoBatchMode,
    isPolishing,
    subtitles,
    autoProcessMode,
    currentActiveTaskId,
    isSystemBusy,
    checkEnvironment,
    startRecognition,
    startBatchProcessing,
    triggerNextBatchItem,
    polishingIds
  };
}
