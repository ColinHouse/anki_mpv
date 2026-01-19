<template>
  <section class="bg-white rounded-xl shadow-xl overflow-hidden">
    <div class="p-4 border-b border-gray-200">
      <h2 class="text-lg font-semibold text-gray-800">视频播放</h2>
      <p v-if="selectedFile" class="text-sm text-gray-600 mt-1">
        {{ selectedFile }}
      </p>
      <!-- Debug info if needed -->
    </div>
    <div class="aspect-w-16 aspect-h-9 bg-black">
      <video
        ref="videoRef"
        class="w-full h-full object-contain"
        controls
        preload="metadata"
        :src="videoSrc"
        @canplay="onCanPlay"
        @timeupdate="onTimeUpdate"
      >
        Your browser does not support the video tag.
      </video>
    </div>

    <!-- 沉浸式提词器字幕 -->
    <div
      class="bg-black/90 p-4 text-center rounded-b-xl"
      :class="{ 'ring-2 ring-yellow-400': isAdjustingOffset }"
    >
      <div class="space-y-2">
        <!-- 上一句 -->
        <div
          v-if="currentSubtitleIndex > 0"
          @click="
            jumpToTime(subtitles[currentSubtitleIndex - 1].startTime)
          "
          class="text-gray-500 text-sm mb-2 transition-all cursor-pointer hover:text-gray-300"
        >
          {{ subtitles[currentSubtitleIndex - 1].text }}
        </div>

        <!-- 当前句 -->
        <div
          v-if="currentSubtitleIndex >= 0"
          class="text-white text-xl font-bold py-1 leading-relaxed transition-all scale-105"
        >
          {{
            currentSubtitleIndex >= 0 &&
            currentSubtitleIndex < subtitles.length
              ? subtitles[currentSubtitleIndex].text
              : "..."
          }}
        </div>

        <!-- 下一句 -->
        <div
          v-if="
            currentSubtitleIndex >= 0 &&
            currentSubtitleIndex < subtitles.length - 1
          "
          @click="
            jumpToTime(subtitles[currentSubtitleIndex + 1].startTime)
          "
          class="text-gray-500 text-sm mt-2 transition-all cursor-pointer hover:text-gray-300"
        >
          {{ subtitles[currentSubtitleIndex + 1].text }}
        </div>
      </div>

      <!-- 字幕偏移微调控件 -->
      <div
        class="mt-3 flex items-center justify-center space-x-2 bg-black/50 rounded-lg p-2"
      >
        <button
          @click="adjustOffset(-0.5)"
          class="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm transition-colors"
        >
          - 0.5s
        </button>
        <span class="text-white text-sm font-medium">
          {{ globalOffset > 0 ? "+" : ""
          }}{{ globalOffset.toFixed(1) }}s
        </span>
        <button
          @click="adjustOffset(0.5)"
          class="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm transition-colors"
        >
          + 0.5s
        </button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useVideoQueue } from "../composables/useVideoQueue";
import { useWhisper } from "../composables/useWhisper";

const props = defineProps<{
  serverPort: number | null;
}>();

const emit = defineEmits<{
  (e: 'time-update', time: number): void;
}>();

// Global State
const { currentVideoPath, selectedFile } = useVideoQueue();
const { isAutoBatchMode, subtitles } = useWhisper();

// Local State
const videoRef = ref<HTMLVideoElement>();
const currentTime = ref(0);
const videoSrc = ref("");

// Teleprompter State
const globalOffset = ref(0);
const isAdjustingOffset = ref(false);

// Methods
const onCanPlay = async () => {
  // 🔇 如果是自动批量模式，强制静音
  if (isAutoBatchMode.value && videoRef.value) {
    videoRef.value.muted = true;
  }
  
  try {
    await videoRef.value?.play();
  } catch (e) {
    console.warn("自动播放受阻:", e);
  }
};

const onTimeUpdate = () => {
  if (videoRef.value) {
    const t = videoRef.value.currentTime;
    currentTime.value = t;
    emit('time-update', t);
  }
};

const jumpToTime = (time: number) => {
  if (videoRef.value) {
    videoRef.value.currentTime = time;
    videoRef.value.play();
  }
};

const adjustOffset = (delta: number) => {
  globalOffset.value += delta;
  isAdjustingOffset.value = true;
  setTimeout(() => {
    isAdjustingOffset.value = false;
  }, 300);
};

// Computed
const currentSubtitleIndex = computed(() => {
  if (!subtitles.value.length) return -1;
  const adjustedTime = currentTime.value - globalOffset.value;
  
  // Find index
  for (let i = 0; i < subtitles.value.length; i++) {
    const sub = subtitles.value[i];
    if (adjustedTime >= sub.startTime && adjustedTime <= sub.endTime) {
      return i;
    }
  }
  // Find gap
  for (let i = 0; i < subtitles.value.length - 1; i++) {
    const currentSub = subtitles.value[i];
    const nextSub = subtitles.value[i + 1];
    if (adjustedTime > currentSub.endTime && adjustedTime < nextSub.startTime) {
      return i; // Still return "previous" subtitle index or wait? 
      // Original logic returned i. (Teleprompter shows current/next correctly)
    }
  }
  if (adjustedTime < subtitles.value[0].startTime) return -1;
  if (adjustedTime > subtitles.value[subtitles.value.length - 1].endTime) {
    return subtitles.value.length - 1;
  }
  return -1;
});

// Watcher for Video Source
watch(currentVideoPath, (newPath) => {
  if (newPath && props.serverPort) {
    const url = new URL(`http://localhost:${props.serverPort}/stream`);
    url.searchParams.set("file", newPath);
    videoSrc.value = url.toString();
    
    if (videoRef.value) {
      videoRef.value.load();
    }
  }
}, { immediate: true });

// Also watch serverPort just in case (e.g. initial load)
watch(() => props.serverPort, (newPort) => {
  if (newPort && currentVideoPath.value) {
    const url = new URL(`http://localhost:${newPort}/stream`);
    url.searchParams.set("file", currentVideoPath.value);
    videoSrc.value = url.toString();
    if (videoRef.value) videoRef.value.load();
  }
});

// Expose
defineExpose({
  jumpToTime,
  currentTime
});
</script>
