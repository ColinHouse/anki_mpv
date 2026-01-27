<template>
  <!-- Global Glass Container -->
  <div
    class="app-container h-screen w-screen overflow-hidden rounded-xl border border-white/50 shadow-2xl flex flex-col relative bg-transparent"
  >
    <!-- Custom Title Bar -->
    <div
      class="window-drag-handle w-full h-8 flex justify-between items-center px-4 bg-white/40 backdrop-blur-md z-50 shrink-0 border-b border-white/10 select-none"
    >
      <div class="flex items-center gap-2">
        <span class="text-xs text-gray-700 font-bold tracking-wider"
          >Anki-MPV AI Studio</span
        >
      </div>

      <!-- Window Controls & Settings -->
      <div class="flex items-center gap-3 no-drag">
        <button
          @click="showSettings = true"
          class="p-1 rounded hover:bg-black/5 transition-colors text-gray-600"
          title="设置"
        >
          ⚙️
        </button>
        <div class="bg-gray-300 w-[1px] h-4 mx-1"></div>
        <button
          @click="minWindow"
          class="p-1 hover:bg-black/5 rounded group"
          title="最小化"
        >
          <svg
            class="w-3 h-3 text-gray-500 group-hover:text-gray-900"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M20 12H4"
            ></path>
          </svg>
        </button>
        <button
          @click="maxWindow"
          class="p-1 hover:bg-black/5 rounded group"
          title="最大化"
        >
          <svg
            class="w-3 h-3 text-gray-500 group-hover:text-gray-900"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
            ></path>
          </svg>
        </button>
        <button
          @click="closeWindow"
          class="p-1 hover:bg-red-500 hover:text-white rounded group"
          title="关闭"
        >
          <svg
            class="w-3 h-3 text-gray-500 group-hover:text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            ></path>
          </svg>
        </button>
      </div>
    </div>

    <!-- Main Content Area (Glassy Background) -->
    <div
      class="flex-1 flex overflow-hidden relative bg-white/80 backdrop-blur-2xl"
    >
      <!-- 侧边栏：任务队列 -->
      <SidebarQueue
        @select-video="loadVideoFromQueue"
        @open-crop="openCropModal"
      />

      <!-- 主内容区 -->
      <main
        class="flex-1 flex flex-col min-w-0 bg-transparent relative overflow-hidden"
      >
        <div class="flex-1 overflow-y-auto p-4 space-y-6">
          <!-- 视频播放区 -->
          <VideoPlayer
            ref="videoPlayerRef"
            :server-port="serverPort"
            @time-update="handleTimeUpdate"
          />

          <!-- 字幕显示区 -->
          <SubtitleList
            :current-time="currentTime"
            @jump-to-time="jumpToTime"
          />
        </div>
      </main>
    </div>

    <!-- 视频预处理模态框 -->
    <CropModal
      v-if="showCropModal"
      :video-path="tempVideoPath"
      @close="showCropModal = false"
      @success="handleCropSuccess"
    />

    <!-- 设置模态框 -->
    <SettingsModal
      :show="showSettings"
      @close="handleSettingsClose"
      :current-file="
        currentVideoPath ? currentVideoPath.split(/[\\/]/).pop() : '未选择'
      "
      :video-duration="videoDuration"
      :is-whisper-ready="isWhisperAvailable"
    />
    <!-- ✅ 全局加载遮罩层 (Loading Overlay) -->
    <div
      v-if="isAutoBatchMode"
      class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm transition-all duration-300"
    >
      <div
        class="bg-white rounded-2xl shadow-2xl p-8 flex flex-col items-center max-w-sm w-full animate-in fade-in zoom-in duration-300"
      >
        <!-- 动画图标 -->
        <div class="relative w-20 h-20 mb-6">
          <div
            class="absolute inset-0 border-4 border-blue-100 rounded-full animate-ping opacity-75"
          ></div>
          <div
            class="absolute inset-0 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"
          ></div>
          <div
            class="absolute inset-0 flex items-center justify-center text-2xl animate-pulse"
          >
            🤖
          </div>
        </div>

        <!-- 文本提示 -->
        <h3 class="text-xl font-bold text-gray-800 mb-2">正在进行批量识别</h3>
        <div class="text-gray-500 text-center text-sm mb-6">
          <div class="text-sm text-gray-700">正在处理...</div>
          <br />
          请勿关闭窗口...
        </div>

        <!-- 进度条（可选） -->
        <div class="w-full bg-gray-100 rounded-full h-2 mb-2 overflow-hidden">
          <div
            class="h-full bg-blue-500 transition-all duration-500"
            :style="{ width: recognitionProgress + '%' }"
          ></div>
        </div>
        <div class="flex justify-between w-full text-xs text-gray-400">
          <span>处理进度</span>
          <span>{{ Math.round(recognitionProgress) }}%</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from "vue";
import { formatTime, parseSRT } from "./utils/subtitle-utils";
import SettingsModal from "./components/SettingsModal.vue";
import SidebarQueue from "./components/SidebarQueue.vue";
import VideoPlayer from "./components/VideoPlayer.vue";
import SubtitleList from "./components/SubtitleList.vue";
import CropModal from "./components/CropModal.vue";
import { QueueItem } from "./types";
import { useVideoQueue } from "./composables/useVideoQueue";
import { useWhisper } from "./composables/useWhisper";

// 全局状态
const videoDuration = ref<number>(0);
const videoPlayerRef = ref(); // Ref for VideoPlayer component

// videoSrc moved to VideoPlayer
const serverPort = ref<number | null>(null);
const currentTime = ref<number>(0);
// currentSubtitleId removed (moved to SubtitleList)

const showSettings = ref(false);

// 视频预处理模态框
const showCropModal = ref(false);
const tempVideoPath = ref<string | null>(null);
// cropStart, cropEnd, cropVideoRef, maxCropDuration moved to CropModal Component

// currentVideoPath removed (moved to useVideoQueue)
const globalStartTime = ref<number>(0);
const globalEndTime = ref<number>(0);

// Batch Queue Types & State
// QueueItem imported from ./types
const {
  videoQueue,
  selectedFilePath,
  currentVideoPath,
  selectedFile,
  loadVideoFromQueue,
} = useVideoQueue();

const {
  isRecognitionRunning, // Keep for lock check (isAnyTaskRunning)
  recognitionProgress, // Keep for Overlay
  isWhisperAvailable, // Keep for SettingsModal prop
  isAutoBatchMode, // Keep for Overlay
  isPolishing, // Keep for polish listeners? Actually App.vue doesn't use it anymore in template. But listeners update it.
  subtitles, // Keep for watcher
  checkEnvironment, // Keep for onMounted
  polishingIds, // Keep if needed? App.vue doesn't seems to use it directly.
} = useWhisper(loadVideoFromQueue);

// ✅ Watch currentVideoPath to handle player and subtitles
watch(currentVideoPath, async (newPath) => {
  if (newPath && serverPort.value) {
    // Video player logic moved to VideoPlayer component
    // Load Subtitles if available
    const item = videoQueue.value.find((v) => v.path === newPath);
    if (item) {
      // Try to find SRT
      const potentialSrt = newPath.replace(/\.[^/.]+$/, ".srt");
      try {
        const exists = await (window as any).api.invoke(
          "check-file-exists",
          potentialSrt,
        );
        if (exists) {
          const content = await (window as any).api.invoke(
            "read-file",
            potentialSrt,
          );
          if (content) {
            const parsed = parseSRT(content);
            subtitles.value = parsed;
            item.status = "completed"; // Mark as completed if srt exists? Maybe not.
            item.srtPath = potentialSrt;
          }
        } else {
          subtitles.value = [];
        }
      } catch (e) {
        console.warn("Failed to load subtitles:", e);
        subtitles.value = [];
      }
    }
  }
});

// ✅ 全局任务独占锁：任何任务运行时都禁用其他操作
const isAnyTaskRunning = computed(() => {
  return isRecognitionRunning.value;
});

// videoRef removed (replaced by videoPlayerRef)
// cropVideoRef moved to CropModal Component

// 获取服务器端口
const getServerPort = async () => {
  try {
    const port = await (window as any).api.getServerPort();
    serverPort.value = port;
    console.log("Server port:", port);
  } catch (error) {
    console.error("Error getting server port:", error);
  }
};

// 视频预处理逻辑已重构到 CropModal 组件
const handleCropSuccess = (newPath: string) => {
  currentVideoPath.value = newPath;
  globalStartTime.value = 0;
  // We don't have exact duration easily here unless passed back or recalculated,
  // but the Player and Queue Item should be updated already.
  // The player will auto-load newPath via watcher.

  if (currentVideoPath.value && serverPort.value) {
    selectedFile.value =
      currentVideoPath.value.split("\\").pop() ||
      currentVideoPath.value.split("/").pop();
    selectedFilePath.value = currentVideoPath.value;

    const url = new URL(`http://localhost:${serverPort.value}/stream`);
    url.searchParams.set("file", currentVideoPath.value);
    url.searchParams.set("start", "0");
    // url.searchParams.set("end", ...); // Optional, or read from file info
    // videoPlayerRef.value?.jumpToTime(0); // Handled by watcher
  }
};

const openCropModal = async (item: QueueItem) => {
  // ✅ 支持二次裁剪：优先使用当前 path (可能是已裁剪的)
  const targetPath = item.path || item.originalPath;
  tempVideoPath.value = targetPath;
  showCropModal.value = true;
};

const handleTimeUpdate = (time: number) => {
  currentTime.value = time;
};

const jumpToTime = (time: number) => {
  videoPlayerRef.value?.jumpToTime(time);
};

const handleSettingsClose = async () => {
  showSettings.value = false;
  await checkEnvironment();
};

onMounted(async () => {
  if ((window as any).api.on) {
    (window as any).api.on("polish-update", (data: any) => {
      const { id, newText, translation, progress } = data;
      const target = subtitles.value.find((s) => s.id === id);
      if (target) {
        target.text = newText;
        target.translation = translation;
      }
    });

    (window as any).api.on("polish-complete", () => {
      isPolishing.value = false;
      alert("✨ 处理完成！");
    });
  }

  // ✅ Auto-check environment on startup
  console.log("🚀 Auto-checking environment on startup...");
  await checkEnvironment();

  await getServerPort();
  await getServerPort();
});

// Window Controls
const minWindow = () => (window as any).api.invoke("window-min");
const maxWindow = () => (window as any).api.invoke("window-max");
const closeWindow = () => (window as any).api.invoke("window-close");
</script>

<style scoped>
/* Window Drag Region */
.window-drag-handle {
  -webkit-app-region: drag;
}
.no-drag {
  -webkit-app-region: no-drag;
}

.app-container {
  /* Using Tailwind for structure, additional glass polish here if needed */
}
</style>
