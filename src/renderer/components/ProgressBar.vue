<template>
  <!-- 双进度条（分段识别） -->
  <div
    v-if="
      whisperStatus.status === 'processing' &&
      whisperStatus.totalSegments > 1
    "
    class="space-y-2 mt-4 p-3 bg-gray-50 rounded-lg border"
  >
    <!-- 总进度条 -->
    <div>
      <div class="flex justify-between text-xs text-gray-500 mb-1">
        <span
          >🚀 总进度 ({{ whisperStatus.currentSegment }}/{{
            whisperStatus.totalSegments
          }})</span
        >
        <span
          >{{ (whisperStatus.overallProgress * 100).toFixed(1) }}%</span
        >
      </div>
      <div class="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          class="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-500"
          :style="{ width: whisperStatus.overallProgress * 100 + '%' }"
        ></div>
      </div>
    </div>

    <!-- 当前片段进度条 -->
    <div>
      <div class="flex justify-between text-xs text-gray-400 mb-1">
        <span>⚡ 当前片段识别中...</span>
        <span>{{ (whisperStatus.progress * 100).toFixed(1) }}%</span>
      </div>
      <div class="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
        <div
          class="h-full bg-blue-400 transition-all duration-300"
          :style="{ width: whisperStatus.progress * 100 + '%' }"
        ></div>
      </div>
    </div>
  </div>

  <!-- 单进度条（短视频或提取音频） -->
  <div
    v-else-if="
      whisperStatus.status === 'processing' ||
      whisperStatus.status === 'extracting'
    "
    class="w-full h-2 bg-gray-200 rounded-full mt-2 overflow-hidden"
  >
    <div
      class="h-full bg-blue-600 transition-all duration-500 ease-out flex items-center justify-end pr-1"
      :style="{ width: whisperStatus.progress * 100 + '%' }"
    ></div>
  </div>
  <div
    v-if="
      whisperStatus.status === 'processing' ||
      whisperStatus.status === 'extracting'
    "
    class="text-xs text-blue-600 mt-1 text-center"
  >
    {{
      whisperStatus.status === "extracting"
        ? "正在提取音频..."
        : "正在识别..."
    }}
    {{ (whisperStatus.progress * 100).toFixed(1) }}%
  </div>
</template>

<script setup lang="ts">

const props = defineProps({
  whisperStatus: {
    type: Object,
    required: true
  }
});
</script>

<style scoped>
/* Smooth transition for progress bars */
.transition-all {
  transition: width 0.5s ease-out;
}
</style>
