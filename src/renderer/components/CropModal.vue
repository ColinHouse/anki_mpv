<template>
  <div
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
    @click.self="$emit('close')"
  >
    <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full">
      <div class="p-4 border-b border-gray-200">
        <h3 class="text-lg font-semibold">视频预处理</h3>
        <p class="text-sm text-gray-600 mt-1">选择要处理的视频片段</p>
      </div>

      <div class="p-4 space-y-4">
        <div
          class="aspect-w-16 aspect-h-9 bg-black rounded-lg overflow-hidden"
        >
          <video
            ref="cropVideoRef"
            class="w-full h-full object-contain"
            controls
            :src="videoPath"
            @loadedmetadata="onCropVideoLoaded"
            @timeupdate="onCropTimeUpdate"
          >
            Your browser does not support the video tag.
          </video>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <label class="text-sm text-gray-600">开始时间</label>
            <input
              v-model.number="cropStart"
              type="number"
              min="0"
              :max="cropEnd - 1"
              step="1"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
              @change="jumpToCropTime(cropStart)"
            />
            <p class="text-xs text-gray-500">秒</p>
          </div>
          <div class="space-y-2">
            <label class="text-sm text-gray-600">结束时间</label>
            <input
              v-model.number="cropEnd"
              type="number"
              min="1"
              :max="maxCropDuration"
              step="1"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
              @change="jumpToCropTime(cropEnd)"
            />
            <p class="text-xs text-gray-500">秒</p>
          </div>
        </div>

        <div class="space-y-2">
          <div class="flex justify-between text-sm text-gray-600">
            <span>当前进度</span>
            <span
              >{{ formatTime(cropCurrentTime) }} /
              {{ formatTime(maxCropDuration) }}</span
            >
          </div>
          <div class="w-full bg-gray-200 rounded-full h-2">
            <div
              class="bg-blue-600 h-2 rounded-full transition-all duration-300"
              :style="{
                width:
                  Math.min((cropCurrentTime / maxCropDuration) * 100, 100) +
                  '%',
              }"
            ></div>
          </div>
        </div>
      </div>

      <div class="p-4 border-t border-gray-200 flex justify-end space-x-2">
        <button
          @click="$emit('close')"
          class="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        >
          取消
        </button>
        <button
          @click="confirmCrop"
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          :disabled="cropStart >= cropEnd"
        >
          确认导入
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { formatTime } from "../utils/subtitle-utils";
import { useVideoQueue } from "../composables/useVideoQueue";

// Props
const props = defineProps<{
  videoPath: string | null;
}>();

// Emits
const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'success', newPath: string): void;
}>();

// Global Data
const { videoQueue } = useVideoQueue();

// Local State
const cropStart = ref<number>(0);
const cropEnd = ref<number>(0);
const cropCurrentTime = ref<number>(0);
const cropVideoRef = ref<HTMLVideoElement>();

// Computed
const maxCropDuration = computed(() => {
  return cropEnd.value || 0;
});

// Methods - Player Logic
const onCropVideoLoaded = () => {
  if (cropVideoRef.value) {
    cropEnd.value = Math.floor(cropVideoRef.value.duration);
  }
};

const onCropTimeUpdate = () => {
  if (cropVideoRef.value) {
    cropCurrentTime.value = cropVideoRef.value.currentTime;
  }
};

const jumpToCropTime = (time: number) => {
  if (cropVideoRef.value) {
    cropVideoRef.value.currentTime = time;
  }
};

// Methods - Core Logic
const confirmCrop = async () => {
  if (cropStart.value >= cropEnd.value) {
    alert("开始时间必须小于结束时间");
    return;
  }

  if (!props.videoPath) return;

  try {
    console.log("✂️ 正在裁剪视频...");

    // Call IPC to trim video
    const result = await (window as any).api.invoke("trim-video", {
      filePath: props.videoPath,
      startTime: cropStart.value,
      endTime: cropEnd.value,
    });

    if (!result.success) {
      alert(`裁剪失败: ${result.error}`);
      return;
    }

    const newPath = result.outputPath;

    // Update Queue
    const targetItem = videoQueue.value.find(
      (i) =>
        i.path === props.videoPath ||
        i.originalPath === props.videoPath,
    );

    if (targetItem) {
      console.log(`✂️ 更新队列项 [${targetItem.name}] 为剪裁后路径`);
      targetItem.path = newPath;
      targetItem.name = "(剪裁) " + targetItem.name.replace("(剪裁) ", ""); // 避免重复前缀
      targetItem.status = "pending";
      targetItem.duration = cropEnd.value - cropStart.value;
    }

    console.log("视频裁剪完成，新路径:", result.outputPath);
    alert("✅ 裁剪完成！");
    
    emit('success', newPath);
    emit('close');

  } catch (error) {
    console.error("裁剪视频时发生错误:", error);
    alert(`裁剪失败: ${(error as Error).message}`);
  }
};

</script>
