<template>
  <section class="bg-white rounded-xl shadow-lg flex flex-col h-full overflow-hidden">
    <div class="p-4 border-b border-gray-100 bg-gray-50/50 space-y-3">
      
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <h2 class="text-lg font-bold text-gray-800">字幕列表</h2>
          <label class="flex items-center space-x-1.5 cursor-pointer text-sm text-gray-600 hover:text-gray-900 bg-white px-2 py-1 rounded border border-gray-200 transition-colors">
            <input
              type="checkbox"
              v-model="showTranslation"
              class="rounded text-blue-500 focus:ring-blue-500"
            />
            <span>双语对照</span>
          </label>
        </div>
        <div class="flex items-center gap-2">
          <button
            @click="importSubtitles"
            class="px-3 py-1.5 text-sm bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1.5 shadow-sm"
            title="导入 .srt 文件"
          >
            📂 导入
          </button>
          
          <button
            @click="startRecognition"
            :disabled="isSystemBusy"
            class="px-4 py-1.5 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg hover:from-blue-600 hover:to-blue-700 shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span v-if="isRecognitionRunning" class="animate-spin">⏳</span>
            <span v-else>✨</span>
            {{ isRecognitionRunning ? '识别中...' : '开始识别' }}
          </button>
        </div>
      </div>
      <div class="flex items-center justify-between text-sm">
        <div class="text-gray-400 text-xs">
          <span v-if="subtitles.length">{{ subtitles.length }} 行字幕</span>
          <span class="mx-2 text-gray-300">|</span>
          <span>当前播放: {{ formatTime(currentTime) }}</span>
        </div>
        
        <div class="flex items-center gap-2">
          <button
            @click="handleBatchTranslate"
            :disabled="subtitles.length === 0 || isSystemBusy || isTranslating"
            class="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-100 rounded hover:bg-blue-100 transition-colors flex items-center gap-1 disabled:opacity-50"
          >
            <span v-if="isTranslating" class="animate-spin">⏳</span>
            <span>{{ isTranslating ? '翻译中...' : '🌍 批量翻译' }}</span>
          </button>
          
          <button
            @click="exportSubtitles"
            :disabled="subtitles.length === 0"
            class="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded hover:bg-gray-100 transition-colors flex items-center gap-1"
          >
            📤 导出
          </button>
        </div>
      </div>
    </div>

    <div
      id="subtitle-list-container"
      class="space-y-2 flex-1 min-h-0 overflow-y-auto"
      @scroll="onSubtitleScroll"
    >
      <div
        v-for="subtitle in subtitles"
        :key="subtitle.id"
        :id="`sub-${subtitle.id}`"
        @dblclick="startEdit(subtitle.id)"
        :class="[
          'p-3 rounded-lg transition-colors group',
          currentSubtitleId === subtitle.id
            ? 'bg-blue-50 text-blue-800 border border-blue-200'
            : 'hover:bg-gray-50 cursor-pointer',
        ]"
      >
        <div v-if="editingId === subtitle.id" class="space-y-2">
          <textarea
            v-model="subtitle.text"
            @blur="saveEdit"
            @keydown.ctrl.enter="saveEdit"
            class="w-full border rounded p-2 text-gray-800 text-base focus:ring-2 focus:ring-blue-500 outline-none"
            rows="2"
            autofocus
          ></textarea>
        </div>
        <div
          v-else
          @click="jumpToTime(subtitle.startTime)"
          class="cursor-pointer"
        >
          <div
            class="flex justify-between items-start"
            @contextmenu.prevent="showContextMenu($event, subtitle)"
          >
            <div class="flex-1">
              <div
                class="font-medium text-gray-800 text-base leading-snug flex items-start group/line"
              >
                <!-- Interactive Tokenized Text -->
                <TokenizedText 
                  :text="subtitle.text" 
                  :context="{
                    videoPath: currentVideoPath || '',
                    startTime: subtitle.startTime,
                    endTime: subtitle.endTime,
                    sentenceText: subtitle.text,
                    sentenceTranslation: subtitle.translation
                  }"
                  class="flex-1" 
                />
                
                <span
                  v-if="polishingIds.has(subtitle.id)"
                  class="ml-2 text-purple-600 animate-spin text-xs"
                  >↻</span
                >
              </div>
              <div
                v-if="showTranslation && subtitle.translation"
                class="text-gray-500 text-sm mt-1 border-l-2 border-blue-200 pl-2"
              >
                {{ subtitle.translation }}
              </div>
            </div>

            <div class="text-xs text-gray-500 ml-2 flex-shrink-0">
              {{ formatTime(subtitle.startTime) }} -
              {{ formatTime(subtitle.endTime) }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Context Menu Component -->
    <ContextMenu 
      :visible="contextMenu.visible"
      :x="contextMenu.x"
      :y="contextMenu.y"
      @close="closeContextMenu"
      @action="handleContextMenuAction"
    />
    
    <EditSubtitleModal 
      v-if="showEditModal"
      :initial-text="editingData.text"
      :initial-trans="editingData.translation"
      @close="showEditModal = false"
      @save="saveSubtitleEdit"
    />
  </section>
    <WordCard
      v-if="showModal"
      :loading="isDictLoading"
      :data="currentWord"
      :context="currentContext"
      :error="dictError"
      @close="showModal = false"
    />
</template>

<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { formatTime, parseSRT} from "../utils/subtitle-utils";
import { useWhisper } from "../composables/useWhisper";
import { useVideoQueue } from "../composables/useVideoQueue";
import { useSegmentation } from "../composables/useSegmentation";
import { useDictionary } from "../composables/useDictionary";
import ContextMenu from "./ContextMenu.vue";
import WordCard from "./WordCard.vue";
import TokenizedText from "./TokenizedText.vue";
import EditSubtitleModal from './EditSubtitleModal.vue';

// Props
const props = defineProps<{
  currentTime: number;
}>();

// Emits
const emit = defineEmits<{
  (e: 'jump-to-time', time: number): void;
}>();

// Global State
const {
  subtitles,
  isPolishing,
  polishingIds,
  whisperStatus,
  startRecognition,
  isRecognitionRunning,
  isSystemBusy
} = useWhisper();

const { currentVideoPath } = useVideoQueue();

const { segmentText } = useSegmentation();
const { lookupWord, currentWord, currentContext, isLoading: isDictLoading, error: dictError, showModal } = useDictionary();

const testSegment = async (text: string) => {
  console.log("Analyzing:", text);
  const result = await segmentText(text);
  console.table(result); // 在控制台漂亮地打印结果
  if (result && result.length > 0) {
      alert(`分词成功！首词：${result[0]?.word} (${result[0]?.reading})`); 
  } else {
      alert("分词返回空结果 (请检查控制台)");
  }
};

// UI State
const showTranslation = ref(true);
const isTranslating = ref(false); // Local state for translation button (or move to useWhisper if global?) App.vue had it local.
const editingId = ref<string | null>(null);
const isUserScrolling = ref(false);
let scrollTimeout: NodeJS.Timeout | null = null;
const contextMenu = ref({
  visible: false,
  x: 0,
  y: 0,
  targetSubtitle: null as any,
});

// Edit State
const showEditModal = ref(false);
const editingIndex = ref(-1);
const editingData = ref({ text: '', translation: '' });

// Computed ID
const currentSubtitleId = computed(() => {
  if (!subtitles.value.length) return null;
  const t = props.currentTime;
  const sub = subtitles.value.find(s => t >= s.startTime && t <= s.endTime);
  return sub ? sub.id : null;
});

// Methods

const handleBatchTranslate = async () => {
  console.log("🖱️ Batch Translate button clicked!"); // ✨ Confirm Click
  if (isTranslating.value) return;
  isTranslating.value = true;
  try {
    // 获取纯文本数组
    const rawTexts = subtitles.value.map(s => s.text);
    console.log("📡 Calling backend batch-translate...", rawTexts.length, "lines"); // ✨ Confirm Call

    // 调用后端
    const translations = await (window as any).api.invoke('batch-translate', rawTexts);
    console.log("✅ Received translations:", translations); // ✨ Confirm Return

    // 回填
    subtitles.value.forEach((sub, i) => {
      if (translations[i] && translations[i] !== "Error" && translations[i] !== "[翻译失败]") {
          sub.translation = translations[i];
      }
    });
  } catch (e) {
    console.error("❌ Translation failed:", e);
    alert("批量翻译出错: " + (e as any).message);
  } finally {
    isTranslating.value = false;
  }
};

const importSubtitles = async () => {
  try {
    const result = await (window as any).api.invoke("import-srt");
    if (!result.success) {
      if (result.error && !result.error.includes("取消")) {
        alert(`导入失败: ${result.error}`);
      }
      return;
    }
    if (!result.content) {
      alert("导入的文件内容为空");
      return;
    }
    const parsedSubtitles = parseSRT(result.content);
    if (!parsedSubtitles || parsedSubtitles.length === 0) {
      alert("无法解析字幕文件，请确保文件格式正确");
      return;
    }
    subtitles.value = parsedSubtitles;
    console.log("前端收到字幕总数:", subtitles.value.length); // 🔍 调试日志
    // whisperStatus logic removed or requires accessing global whisperStatus via useWhisper if needed.
    // In App.vue it did: whisperStatus.value.status = "completed";
    if (whisperStatus.value) {
        whisperStatus.value.status = "completed";
        whisperStatus.value.progress = 1.0;
    }
    alert(`字幕导入成功！共 ${parsedSubtitles.length} 条字幕`);
  } catch (error) {
    console.error("Error importing subtitles:", error);
    alert(`导入字幕失败: ${(error as Error).message}`);
  }
};

const exportSubtitles = async () => {
  if (subtitles.value.length === 0) {
    alert("没有可导出的字幕");
    return;
  }
  try {
    let content = "";
    subtitles.value.forEach((sub, index) => {
      // 本地 formatTime (用于SRT导出)
      const formatSrtTime = (t: number) => {
        const date = new Date(0);
        date.setMilliseconds(t * 1000);
        return date.toISOString().substr(11, 12).replace(".", ",");
      };

      content += `${index + 1}\n`;
      content += `${formatSrtTime(sub.startTime)} --> ${formatSrtTime(sub.endTime)}\n`;
      content += `${sub.text}\n`;
      if (showTranslation.value && sub.translation) {
        content += `${sub.translation}\n`;
      }
      content += `\n`;
    });

    const result = await (window as any).api.invoke("export-srt", content);
    if (result.success) {
      alert("✅ 字幕导出成功");
    } else if (!result.error?.includes("取消")) {
      alert(`导出失败: ${result.error}`);
    }
  } catch (error) {
    console.error("Export failed:", error);
    alert(`导出失败: ${(error as Error).message}`);
  }
};

const startEdit = (id: string) => {
  editingId.value = id;
};

const saveEdit = () => {
  editingId.value = null;
};

const jumpToTime = (time: number) => {
  emit('jump-to-time', time);
};

const onSubtitleScroll = () => {
  isUserScrolling.value = true;
  if (scrollTimeout) clearTimeout(scrollTimeout);
  scrollTimeout = setTimeout(() => {
    isUserScrolling.value = false;
  }, 3000);
};

// Context Menu
const showContextMenu = (event: MouseEvent, subtitle: any) => {
  contextMenu.value = {
    visible: true,
    x: event.clientX,
    y: event.clientY,
    targetSubtitle: subtitle,
  };
};

const closeContextMenu = () => {
  contextMenu.value.visible = false;
};

// Handle Menu Action
const handleContextMenuAction = (action: string) => {
  contextMenu.value.visible = false;
  if (!contextMenu.value.targetSubtitle) return;

  if (action === 'edit') {
    const sub = contextMenu.value.targetSubtitle;
    const idx = subtitles.value.findIndex(s => s.id === sub.id);
    if (idx > -1) {
      editingIndex.value = idx;
      editingData.value = { text: sub.text, translation: sub.translation || '' };
      showEditModal.value = true;
    }
  }
};

const saveSubtitleEdit = (newData: { text: string; translation: string }) => {
  if (editingIndex.value > -1 && subtitles.value[editingIndex.value]) {
    subtitles.value[editingIndex.value].text = newData.text;
    subtitles.value[editingIndex.value].translation = newData.translation;
  }
  showEditModal.value = false;
};

// Auto Scroll Watcher
watch(() => currentSubtitleId.value, (newId) => {
  if (newId && !isUserScrolling.value) {
     const subtitleElement = document.getElementById(`sub-${newId}`);
      const container = document.getElementById("subtitle-list-container");
      if (subtitleElement && container) {
        const topPos = subtitleElement.offsetTop - container.offsetTop;
        container.scrollTo({
          top:
            topPos -
            container.clientHeight / 2 +
            subtitleElement.clientHeight / 2,
          behavior: "smooth",
        });
      }
  }
});

// Event Listeners for translation status (moved from App.vue onMounted)
// Note: App.vue had these in onMounted.
// Since SubtitleList is part of the view, we can put them here too,
// OR keep them in App.vue if they are "global app logic".
// BUT `startTranslationOnly` sets `isTranslating` locally here, so we need to know when it finishes.
// Let's listen here? Or rely on useWhisper?
// useWhisper doesn't export `isTranslating` currently (check file).
// App.vue defined `isTranslating` locally.
// I will keep the listeners here for now to close the loop on the button state.

import { onMounted, onUnmounted } from "vue";

const onPolishComplete = () => {
  isTranslating.value = false;
  isPolishing.value = false; // also update global? global isPolishing is from useWhisper.
  // Wait, isPolishing is destructured from useWhisper. It is a Ref.
  // We can write to it if it's a ref.
  // Yes, useWhisper exports refs.
  alert("✨ 处理完成！");
};

// We need to listen to IPC events.
const removeListeners = () => {
    // Only if api.off exists (it might not be exposed, usually standard electron preload exposes send/invoke/on)
    // If not off, risk of memory leak?
    // App.vue didn't remove them.
};

onMounted(() => {
    if ((window as any).api.on) {
        // polish-update is handled globally? 
        // No, App.vue handled it to update subtitles.
        // But subtitles are shared via useWhisper. So whoever updates them updates everyone.
        // Let's add listener here to update subtitles (as App.vue did).
        
        (window as any).api.on("polish-update", (data: any) => {
          const { id, newText, translation, progress } = data;
          const target = subtitles.value.find((s) => s.id === id);
          if (target) {
            target.text = newText;
            target.translation = translation;
          }
        });

        (window as any).api.on("polish-complete", onPolishComplete);
    }
    
    // Silently initialize Anki infrastructure
    (window as any).api.invoke('init-anki').then((res: any) => {
        if (res.success) console.log("✅ Anki initialized successfully");
        else console.debug("Anki init skipped/failed (Anki might be closed):", res.error);
    });
});

</script>
