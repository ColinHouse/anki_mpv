<template>
  <aside
    class="bg-gray-100 border-r border-gray-200 flex flex-col z-10 flex-shrink-0 transition-all duration-300 ease-in-out relative"
    :class="isSidebarOpen ? 'w-80' : 'w-14'"
  >
    <!-- 折叠/展开按钮 -->
    <button
      @click="isSidebarOpen = !isSidebarOpen"
      class="absolute -right-3 top-4 bg-white border-2 border-gray-300 rounded-full w-6 h-6 flex items-center justify-center shadow-md hover:bg-gray-50 hover:shadow-lg transition-all z-50"
      :title="isSidebarOpen ? '折叠侧边栏' : '展开侧边栏'"
    >
      <span class="text-xs font-bold text-gray-600">{{
        isSidebarOpen ? "◀" : "▶"
      }}</span>
    </button>

    <!-- 头部 -->
    <div class="p-4 border-b border-gray-200 bg-white" v-if="isSidebarOpen">
      <div class="flex justify-between items-center">
        <h2 class="font-bold text-gray-700">任务队列</h2>
        <span class="text-xs text-gray-500"
          >{{ videoQueue.length }} 个</span
        >
      </div>
    </div>
    <div
      class="py-3 border-b border-gray-200 bg-white flex justify-center"
      v-else
    >
      <span class="text-lg" title="任务队列">📋</span>
    </div>

    <!-- 队列列表 -->
    <div class="flex-1 overflow-y-auto p-2 space-y-2">
      <div
        v-for="item in videoQueue"
        :key="item.id"
        class="bg-white rounded-lg shadow-sm border border-gray-100 relative group cursor-pointer transition-all"
        :class="{
          'border-blue-400 ring-1 ring-blue-100':
            item.status === 'processing',
          'hover:border-blue-300 hover:shadow':
            item.status !== 'processing',
        }"
        @click="$emit('select-video', item)"
      >
        <!-- 展开状态 -->
        <div v-if="isSidebarOpen" class="p-3">
          <div class="flex items-start gap-3">
            <!-- 状态图标 -->
            <div
              class="flex-shrink-0 w-5 h-5 flex items-center justify-center mt-0.5"
            >
              <span
                v-if="item.status === 'pending'"
                class="text-gray-400 text-base"
                >⏳</span
              >
              <span
                v-else-if="item.status === 'processing'"
                class="animate-spin text-blue-500 text-base"
                >🔄</span
              >
              <span
                v-else-if="item.status === 'completed'"
                class="text-green-500 text-base"
                >✅</span
              >
              <span
                v-else-if="item.status === 'error'"
                class="text-red-500 text-base"
                >❌</span
              >
            </div>

            <!-- 信息 -->
            <div class="flex-1 min-w-0">
              <div
                class="text-sm font-medium text-gray-800 truncate"
                :title="item.originalPath || item.path"
              >
                {{ item.name }}
              </div>
              <div class="text-xs text-gray-500 mt-0.5">
                <span v-if="item.status === 'completed' && item.srtPath"
                  >✓ 已导出 SRT</span
                >
                <span v-else-if="item.status === 'processing'"
                  >处理中...</span
                >
                <span v-else-if="item.status === 'error'">失败</span>
                <span v-else>待处理</span>
              </div>
            </div>
          </div>

          <!-- 操作按钮 (hover显示) -->
          <div
            v-if="item.status !== 'processing'"
            class="flex gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <button
              @click.stop="$emit('open-crop', item)"
              class="flex-1 bg-white border border-gray-300 hover:bg-purple-50 hover:border-purple-400 text-xs py-1.5 rounded text-gray-700 hover:text-purple-700 flex items-center justify-center gap-1 transition-colors font-medium"
              title="剪裁此视频"
            >
              <span>✂️</span> 剪裁
            </button>
            <button
              @click.stop="removeFromQueue(item.id)"
              class="px-3 bg-white border border-gray-300 hover:bg-red-50 hover:border-red-400 text-red-500 text-xs py-1.5 rounded transition-colors font-medium"
              title="移除"
            >
              🗑️
            </button>
          </div>
        </div>

        <!-- 折叠状态 -->
        <div v-else class="flex justify-center py-2" :title="item.name">
          <span v-if="item.status === 'pending'" class="text-gray-400"
            >⏳</span
          >
          <span
            v-else-if="item.status === 'processing'"
            class="animate-spin text-blue-500"
            >🔄</span
          >
          <span
            v-else-if="item.status === 'completed'"
            class="text-green-500"
            >✅</span
          >
          <span v-else-if="item.status === 'error'" class="text-red-500"
            >❌</span
          >
        </div>
      </div>

      <div
        v-if="videoQueue.length === 0"
        class="text-center py-10 text-gray-400 text-sm"
      >
        <div class="text-3xl mb-2" v-if="isSidebarOpen">📭</div>
        <div class="text-2xl" v-else>📭</div>
        <span v-if="isSidebarOpen">空空如也<br />请添加视频</span>
      </div>
    </div>

    <!-- 侧边栏底部操作 -->
    <div
      class="p-4 bg-white border-t border-gray-200 space-y-2"
      v-if="isSidebarOpen"
    >
      <button
        @click="addVideosToQueue"
        class="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg flex items-center justify-center gap-2 transition-colors font-medium border border-gray-300"
        :disabled="isAutoBatchMode"
      >
        <span>➕</span> 添加视频
      </button>

      <!-- 批量剪裁按钮 -->
      <button
        @click="showBatchTrim = true"
        :disabled="
          isAutoBatchMode || isTrimming || videoQueue.length === 0
        "
        class="w-full py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg flex items-center justify-center gap-2 transition-colors font-medium shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span v-if="isTrimming" class="animate-spin">⏳</span>
        <span v-else>✂️</span>
        {{ isTrimming ? "剪裁中..." : "批量剪裁" }}
      </button>
      
      <!-- ✅ 输出目录显示 -->
      <div 
        v-if="outputDir" 
        class="px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-xs"
      >
        <div class="text-green-700 font-medium mb-1">📁 保存位置:</div>
        <div class="text-green-600 break-all" :title="outputDir">
          {{ outputDir }}
        </div>
      </div>
      
      <button
        @click="startBatchProcessing"
        class="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center gap-2 transition-colors font-bold shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
        :disabled="isAnyTaskRunning || videoQueue.length === 0 || !isWhisperAvailable"
      >
        <span v-if="isAutoBatchMode" class="animate-spin">🔄</span>
        <span v-else>▶️</span>
        {{ isAutoBatchMode ? "处理中..." : "开始批量处理" }}
      </button>
    </div>

    <!-- 折叠状态的底部按钮 -->
    <div class="p-2 bg-white border-t border-gray-200 space-y-2" v-else>
      <button
        @click="addVideosToQueue"
        class="w-full py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        :disabled="isSystemBusy"
        title="添加视频"
      >
        <span>➕</span>
      </button>
      <button
        @click="startBatchProcessing"
        class="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
        :disabled="isAnyTaskRunning || videoQueue.length === 0 || !isWhisperAvailable"
        title="开始批量处理"
      >
        <span v-if="isAutoBatchMode" class="animate-spin">🔄</span>
        <span v-else>▶️</span>
      </button>
    </div>
  </aside>

  <!-- Batch Trim Modal -->
  <div
    v-if="showBatchTrim"
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
    @click.self="showBatchTrim = false"
  >
    <div class="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
      <h3 class="text-lg font-semibold mb-4 text-gray-800">批量时间剪裁</h3>
      <p class="text-sm text-gray-600 mb-4">
        为队列中所有视频应用统一的时间范围
      </p>

      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1"
            >开始时间</label
          >
          <input
            v-model="batchTrimStart"
            type="text"
            placeholder="00:00 或秒数"
            class="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-yellow-400 outline-none"
          />
          <p class="text-xs text-gray-500 mt-1">
            格式: MM:SS 或 H:MM:SS 或直接输入秒数
          </p>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1"
            >结束时间</label
          >
          <input
            v-model="batchTrimEnd"
            type="text"
            placeholder="01:30 (留空=到结尾)"
            class="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-yellow-400 outline-none"
          />
          <p class="text-xs text-gray-500 mt-1">留空则剪裁到视频结尾</p>
        </div>
      </div>

      <div class="flex gap-3 mt-6">
        <button
          @click="showBatchTrim = false"
          class="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 transition-colors font-medium"
        >
          取消
        </button>
        <button
          @click="performBatchTrim"
          class="flex-1 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors font-bold shadow-md"
        >
          ✂️ 确认剪裁
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useVideoQueue } from '../composables/useVideoQueue';
import { useWhisper } from '../composables/useWhisper';

const emit = defineEmits(['open-crop', 'select-video']);

const { videoQueue, isSidebarOpen, outputDir, addVideosToQueue, removeFromQueue } = useVideoQueue();
const { isAutoBatchMode, isWhisperAvailable, startBatchProcessing } = useWhisper();

// Batch Trim State
const showBatchTrim = ref(false);
const batchTrimStart = ref("00:00");
const batchTrimEnd = ref("");
const isTrimming = ref(false);

const isSystemBusy = computed(() => {
   // Assuming isSystemBusy logic is if any task is processing
   return videoQueue.value.some(item => item.status === 'processing');
});

// Assuming isAnyTaskRunning logic
const isAnyTaskRunning = computed(() => {
  return isAutoBatchMode.value || isTrimming.value;
});


// 时间转秒辅助函数
const timeToSeconds = (str: string): number | undefined => {
  if (!str || str.trim() === "") return undefined;

  // 尝试直接解析为数字
  const directNum = Number(str);
  if (!isNaN(directNum)) return directNum;

  // 解析 MM:SS 或 H:MM:SS 格式
  const parts = str.split(":").map(Number);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];

  return 0;
};

// 执行批量剪裁
const performBatchTrim = async () => {
  const startSeconds = timeToSeconds(batchTrimStart.value);
  const endSeconds = timeToSeconds(batchTrimEnd.value);

  // 强制赋予默认值 0，防止 undefined
  const finalStart = typeof startSeconds === "number" ? startSeconds : 0;
  const finalEnd = typeof endSeconds === "number" ? endSeconds : undefined;

  if (videoQueue.value.length === 0) {
    alert("队列为空，无法剪裁");
    return;
  }

  // 验证时间参数
  if (finalEnd !== undefined && finalEnd <= finalStart) {
    alert("结束时间必须大于开始时间");
    return;
  }

  console.log(
    `🚀 批量剪裁参数: start=${finalStart}s, end=${finalEnd !== undefined ? finalEnd + "s" : "结尾"}`,
  );

  isTrimming.value = true;
  showBatchTrim.value = false;

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < videoQueue.value.length; i++) {
    const item = videoQueue.value[i];

    // 跳过正在处理的项
    if (item.status === "processing") continue;

    try {
      // 使用 originalPath，避免多次剪裁
      const sourcePath = item.originalPath || item.path;

      // 标记为处理中
      item.status = "processing";

      console.log(
        `✂️ 剪裁 [${item.name}] 从 ${finalStart}s 到 ${finalEnd !== undefined ? finalEnd + "s" : "end"}`,
      );

      // ✅ 使用对象传参，确保 Key 匹配
      const result = await (window as any).api.invoke("trim-video", {
        filePath: sourcePath,
        startTime: finalStart,
        endTime: finalEnd,
      });

      // ✅ 严格验证：仅当成功且输出文件存在时才更新状态为 pending
      if (result.success && result.outputPath) {
        // 二次验证：确保文件确实存在（防止 ffmpeg 报成功但文件丢失）
        const fileExists = await (window as any).api.invoke("check-file-exists", result.outputPath);
        
        if (fileExists) {
          // 更新路径
          item.path = result.outputPath;
          const timeLabel =
            finalEnd !== undefined
              ? `${batchTrimStart.value}-${batchTrimEnd.value}`
              : `${batchTrimStart.value}-End`;
          item.name = `(剪裁 ${timeLabel}) ${item.name.replace(/^\(剪裁.*?\) /, "")}`;
          item.status = "pending";
          item.duration =
            finalEnd !== undefined ? finalEnd - finalStart : undefined;
          successCount++;
          console.log(`✅ [Batch Trim] Success: ${item.name}`);
        } else {
          throw new Error("裁剪完成但输出文件不存在");
        }
      } else {
        throw new Error(result.error || "剪裁失败");
      }
    } catch (e) {
      console.error(`剪裁 ${item.name} 失败:`, e);
      item.status = "error"; // ✅ 明确标记失败
      failCount++;
    }
  }

  isTrimming.value = false;

  if (failCount > 0) {
    alert(`批量剪裁完成！\n成功: ${successCount}\n失败: ${failCount}`);
  } else {
    alert(`✅ 批量剪裁完成！已处理 ${successCount} 个视频`);
  }
};
</script>
