<template>
  <div class="bg-white rounded-xl shadow-lg p-4 mt-4">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-semibold text-gray-800">字幕提词器</h2>
      <div class="text-sm text-gray-600">
        当前播放: {{ formatTime(currentTime) }}
      </div>
    </div>

    <!-- Three-line teleprompter display -->
    <div class="teleprompter-container">
      <!-- Previous subtitle -->
      <div
        v-if="previousSubtitle"
        class="teleprompter-line previous-line"
        :class="{ 'fade-in': showPrevious }"
      >
        {{ previousSubtitle.text }}
      </div>

      <!-- Current subtitle (centered and highlighted) -->
      <div
        v-if="currentSubtitle"
        class="teleprompter-line current-line"
        :class="{ 'fade-in': showCurrent }"
      >
        {{ currentSubtitle.text }}
      </div>

      <!-- Next subtitle -->
      <div
        v-if="nextSubtitle"
        class="teleprompter-line next-line"
        :class="{ 'fade-in': showNext }"
      >
        {{ nextSubtitle.text }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { formatTime } from "../utils/subtitle-utils";

const props = defineProps({
  subtitles: {
    type: Array as () => Array<{
      id: string;
      text: string;
      startTime: number;
      endTime: number;
    }>,
    required: true
  },
  currentTime: {
    type: Number,
    required: true
  }
});

// Calculate current subtitle index
const currentIndex = computed(() => {
  return props.subtitles.findIndex(sub =>
    props.currentTime >= sub.startTime && props.currentTime <= sub.endTime
  );
});

// Get previous, current, and next subtitles
const previousSubtitle = computed(() => {
  return currentIndex.value > 0 ? props.subtitles[currentIndex.value - 1] : null;
});

const currentSubtitle = computed(() => {
  return currentIndex.value >= 0 ? props.subtitles[currentIndex.value] : null;
});

const nextSubtitle = computed(() => {
  return currentIndex.value < props.subtitles.length - 1
    ? props.subtitles[currentIndex.value + 1]
    : null;
});

// Animation states
const showPrevious = ref(false);
const showCurrent = ref(false);
const showNext = ref(false);

// Watch for subtitle changes to trigger animations
watch([currentIndex, props.currentTime], ([newIndex, newTime]) => {
  // Reset animation states
  showPrevious.value = false;
  showCurrent.value = false;
  showNext.value = false;

  // Trigger animations with slight delays
  setTimeout(() => {
    if (previousSubtitle.value) showPrevious.value = true;
    if (currentSubtitle.value) showCurrent.value = true;
    if (nextSubtitle.value) showNext.value = true;
  }, 50);
}, { immediate: true });
</script>

<style scoped>
.teleprompter-container {
  min-height: 120px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 8px;
  padding: 16px;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border-radius: 12px;
  margin-top: 12px;
}

.teleprompter-line {
  transition: all 0.3s ease-in-out;
  opacity: 0;
  transform: translateY(10px);
  text-align: center;
  padding: 8px 16px;
  border-radius: 8px;
}

.teleprompter-line.fade-in {
  opacity: 1;
  transform: translateY(0);
}

.previous-line {
  font-size: 14px;
  color: #64748b;
  max-width: 80%;
  font-style: italic;
}

.current-line {
  font-size: 18px;
  font-weight: 600;
  color: #3b82f6;
  background: linear-gradient(90deg, #e0f2fe 0%, #dbeafe 100%);
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.1);
  max-width: 90%;
}

.next-line {
  font-size: 14px;
  color: #64748b;
  max-width: 80%;
  font-style: italic;
  opacity: 0.8;
}
</style>
