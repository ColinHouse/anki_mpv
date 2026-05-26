<template>
  <div
    v-if="show"
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
  >
    <div class="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4">
      <!-- Header -->
      <div class="flex justify-between items-center p-6 border-b">
        <h2 class="text-xl font-semibold">设置</h2>
        <button @click="close" class="text-gray-400 hover:text-gray-600">
          ✕
        </button>
      </div>

      <!-- Content -->
      <div class="flex h-96">
        <!-- Left Navigation -->
        <div class="w-64 border-r p-4">
          <nav class="space-y-2">
            <button
              v-for="tab in tabs"
              :key="tab.id"
              @click="activeTab = tab.id"
              :class="[
                'w-full text-left px-4 py-2 rounded-md',
                activeTab === tab.id
                  ? 'bg-blue-100 text-blue-700'
                  : 'hover:bg-gray-100',
              ]"
            >
              {{ tab.name }}
            </button>
          </nav>
        </div>

        <!-- Right Content -->
        <div class="flex-1 p-6 overflow-y-auto">
          <!-- Tab 1: Transcription -->
          <div v-if="activeTab === 'models'" class="space-y-4">
            <h3 class="text-lg font-medium">Transcription Workflow</h3>

            <div class="bg-blue-50 border border-blue-100 rounded-lg p-4">
              <h4 class="font-semibold text-blue-900">Subtitle-first demos</h4>
              <p class="text-sm text-blue-800 mt-1 leading-6">
                The app now runs without local speech models. Import .srt/.vtt files for stable demos, use cached transcripts, or generate a local Mock Cloud transcript.
              </p>
            </div>

            <div class="grid grid-cols-1 gap-3">
              <div class="border border-emerald-200 rounded-lg p-4 bg-emerald-50">
                <div class="flex items-center justify-between">
                  <div>
                    <h4 class="font-medium text-gray-900">Import Subtitle</h4>
                    <p class="text-sm text-gray-600 mt-1">Best for stable demos and real study sessions.</p>
                  </div>
                  <span class="px-2 py-1 rounded-full text-xs font-semibold bg-white text-emerald-700 border border-emerald-200">Primary</span>
                </div>
              </div>

              <div class="border border-blue-200 rounded-lg p-4 bg-blue-50">
                <div class="flex items-center justify-between">
                  <div>
                    <h4 class="font-medium text-gray-900">Mock Cloud ASR</h4>
                    <p class="text-sm text-gray-600 mt-1">Demo transcript generated locally. No paid API or GPU required.</p>
                  </div>
                  <span class="px-2 py-1 rounded-full text-xs font-semibold bg-white text-blue-700 border border-blue-200">Demo</span>
                </div>
              </div>

              <div class="border border-amber-200 rounded-lg p-4 bg-amber-50">
                <div class="flex items-center justify-between">
                  <div>
                    <h4 class="font-medium text-gray-900">Cloud ASR</h4>
                    <p class="text-sm text-gray-600 mt-1">Provider interface is ready for future OpenAI, Google, Azure, or AWS integration.</p>
                  </div>
                  <span class="px-2 py-1 rounded-full text-xs font-semibold bg-white text-amber-700 border border-amber-200">Configurable</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Tab 2: 存储管理 -->
          <div v-if="activeTab === 'storage'" class="space-y-4">
            <h3 class="text-lg font-medium">存储管理</h3>

            <div class="bg-gray-50 rounded-lg p-4">
              <div class="flex justify-between items-center">
                <span class="text-lg font-medium">临时文件占用</span>
                <span class="text-2xl font-bold"
                  >{{ tempSize.toFixed(2) }} MB</span
                >
              </div>
              <p class="text-xs text-gray-500 mt-2">
                提示: 程序退出时会自动清理所有临时文件
              </p>
            </div>
          </div>

          <!-- Tab 3: 实验室 -->
          <div v-if="activeTab === 'lab'" class="space-y-4">
            <h3 class="text-lg font-medium">实验室 - 嵌入式 LLM</h3>

            <div class="space-y-4">
              <!-- 嵌入式 LLM 模型 -->
              <div class="bg-gray-50 rounded-lg p-4 space-y-3">
                <div class="flex items-center justify-between">
                  <div>
                    <h4 class="text-sm font-semibold text-gray-700">Gemma 2 (2B) - 嵌入式</h4>
                    <p class="text-xs text-gray-500 mt-1">无需外部软件，直接运行在应用内</p>
                  </div>
                  <span
                    :class="[
                      'px-2 py-1 rounded text-xs font-medium',
                      llmModelInstalled
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800',
                    ]"
                  >
                    {{ llmModelInstalled ? '✅ 已就绪' : '❌ 未安装' }}
                  </span>
                </div>

                <div class="text-xs text-gray-600 bg-white rounded p-3 border">
                  <div class="flex justify-between mb-1">
                    <span>模型大小:</span>
                    <span class="font-medium">~1.6 GB</span>
                  </div>
                  <div class="flex justify-between">
                    <span>存储位置:</span>
                    <span class="font-mono text-xs">resources/models</span>
                  </div>
                </div>

                <!-- 下载/导入按钮组 -->
                <div class="flex gap-3">
                  <!-- 下载按钮 (未安装时显示) -->
                  <button
                    v-if="!llmModelInstalled"
                    @click="downloadLlmModel"
                    :disabled="llmModelDownloading"
                    class="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span v-if="!llmModelDownloading">⬇️</span>
                    <span v-else class="animate-spin">⏳</span>
                    <span>{{ llmModelDownloading ? '下载中...' : '下载模型 (1.6GB)' }}</span>
                  </button>

                  <!-- 已下载按钮 (已安装时显示) -->
                  <button
                    v-else
                    disabled
                    class="flex-1 px-4 py-2 bg-gray-100 text-gray-400 border border-gray-200 rounded-lg flex items-center justify-center gap-2 cursor-not-allowed"
                  >
                    <span>✅</span>
                    <span>已下载</span>
                  </button>
                  
                  <button 
                    @click="handleImport" 
                    class="flex-1 px-4 py-2 bg-gray-100 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                  >
                    <span>📂</span>
                    <span>{{ llmModelInstalled ? '重新导入' : '导入本地文件' }}</span>
                  </button>
                </div>

                <!-- 下载进度 -->
                <div
                  v-if="llmModelDownloading"
                  class="space-y-2 p-3 bg-white rounded border"
                >
                  <div class="flex justify-between text-sm">
                    <span class="text-gray-600">正在下载...</span>
                    <span class="font-medium">{{ llmDownloadProgress }}%</span>
                  </div>
                  <div class="w-full bg-gray-200 rounded-full h-2">
                    <div
                      class="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      :style="{ width: llmDownloadProgress + '%' }"
                    ></div>
                  </div>
                  <p class="text-xs text-gray-500">正在下载 LLM 模型，请稍候...</p>
                </div>

                <!-- 已安装提示 (Enhanced) -->
                <div
                  v-if="llmModelInstalled && !llmModelDownloading"
                  class="bg-green-50 border border-green-200 rounded-lg p-4 mb-4 flex items-center gap-3"
                >
                  <div class="bg-green-100 p-2 rounded-full text-green-600">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                  </div>
                  <div>
                    <h4 class="font-bold text-green-800">Gemma 2 (2B) - 已就绪</h4>
                    <p class="text-xs text-green-700">本地 AI 服务运行正常</p>
                  </div>
                </div>
              </div>

              <!-- 使用说明 -->
              <div class="border border-gray-200 rounded-lg p-4">
                <h4 class="text-sm font-semibold text-gray-700 mb-2">使用说明</h4>
                <ul class="text-xs text-gray-600 space-y-1">
                  <li>• 首次使用需要下载模型，大小约 1.6GB</li>
                  <li>• 模型运行在本地，无需联网，数据不会上传</li>
                  <li>• 支持字幕润色、错别字修正等功能</li>
                  <li>• 首次加载模型需要 10-30 秒，请耐心等待</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="flex justify-between p-6 border-t">
        <div class="text-sm text-gray-600 space-y-1">
          <div>状态信息:</div>
          <div>• Transcription workflow: {{ isTranscriptionAvailable ? "Ready" : "Unavailable" }}</div>
          <div>• 当前文件: {{ selectedFile || "未选择" }}</div>
          <div>• 视频时长: {{ formatTime(videoDuration) }}</div>
        </div>
        <div class="flex space-x-2">
          <button
            @click="handleCheckEnvironment"
            class="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Check Workflow
          </button>

          <button
            @click="clearTemp"
            :disabled="clearing"
            class="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <span v-if="clearing" class="animate-spin">⏳</span>
            <span>清除缓存</span>
          </button>

          <button
            @click="close"
            class="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, toRaw } from "vue";

interface Settings {
  activeModel: string;
  ollamaUrl: string;
  llmModel: string;
}

// 全局状态（从 App.vue 传递或通过事件通信）
// 注意：window.api 的类型已经在 main.ts 中声明，这里不需要重复声明

const props = defineProps<{
  show: boolean;
  currentFile?: string;
  videoDuration?: number;
  isTranscriptionReady?: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();

// 状态管理（从 App.vue 传递或通过事件通信）
const selectedFile = ref<string | null>(null);
const selectedFilePath = ref<string | null>(null);
const videoDuration = ref<number>(0);
const isTranscriptionAvailable = ref(true);

// 监听 props 变化，更新本地状态
watch(() => props.currentFile, (newVal) => {
  selectedFile.value = newVal;
});

watch(() => props.videoDuration, (newVal) => {
  videoDuration.value = newVal || 0;
});

watch(() => props.isTranscriptionReady, (newVal) => {
  isTranscriptionAvailable.value = newVal !== false;
});

const settings = ref<Settings>({
  activeModel: "small",
  ollamaUrl: "http://localhost:11434",
  llmModel: "gemma2",
});

const tempSize = ref(0);
const clearing = ref(false);

// Ollama 连接状态
const ollamaModels = ref<string[]>([]);
const ollamaLoading = ref(false);
const ollamaError = ref<string>("");
const showAdvancedSettings = ref(false);

// Embedded LLM model state (single model: gemma2-2b)
const llmModelInstalled = ref<boolean>(false);
const llmModelDownloading = ref<boolean>(false);
const llmDownloadProgress = ref<number>(0);

// LLM model management state
const selectedLlmModel = ref<string>("");
const llmModelStatus = ref<Record<string, { installed: boolean; downloading: boolean; progress: number; status?: string; message?: string }>>({
  gemma2: { installed: false, downloading: false, progress: 0 },
  llama3: { installed: false, downloading: false, progress: 0 },
  mistral: { installed: false, downloading: false, progress: 0 },
});
const ollamaHealthStatus = ref<'unknown' | 'healthy' | 'unhealthy'>('unknown');

const tabs = [
  { id: "models", name: "Transcription" },
  { id: "storage", name: "存储" },
  { id: "lab", name: "实验室" },
];

const activeTab = ref("models");

// 初始化
onMounted(() => {
  loadSettings();
  getTempSize();
  
  // Check LLM model status on mount
  checkLlmModelStatus();
  
  // Listen to LLM download progress events
  window.api.on('llm-download-progress', (data: any) => {
    console.log('LLM download progress:', data);
    if (!data || !data.modelName) return;

    const { modelName, progress } = data;
    
    // We only care about gemma2-2b
    if (modelName === 'gemma2-2b') {
      llmModelDownloading.value = true;
      llmDownloadProgress.value = progress || 0;

      // Mark as installed when download completes
      if (progress >= 100) {
        llmModelInstalled.value = true;
        llmModelDownloading.value = false;
        llmDownloadProgress.value = 100;
      }
    }
  });
});

// 监听设置变化
watch(
  settings,
  (newSettings) => {
    // 使用 toRaw 或 JSON 序列化剥离 Proxy，避免 IPC 克隆错误
    window.api.invoke("save-settings", JSON.parse(JSON.stringify(toRaw(newSettings))));
  },
  { deep: true }
);

// 加载设置
async function loadSettings() {
  try {
    const result = await window.api.invoke("get-settings");
    settings.value = { ...settings.value, ...result };
  } catch (error) {
    console.error("加载设置失败:", error);
  }
}

// 获取临时文件大小
async function getTempSize() {
  try {
    const size = await window.api.invoke("get-temp-size");
    tempSize.value = size;
  } catch (error) {
    console.error("获取临时文件大小失败:", error);
  }
}

// 清理临时文件
async function clearTemp() {
  clearing.value = true;
  try {
    await window.api.invoke("clear-temp-dir");
    await getTempSize();
    alert("缓存清理成功！");
  } catch (error) {
    console.error("清理临时文件失败:", error);
  } finally {
    clearing.value = false;
  }
}

// 检查环境
async function checkEnvironment() {
  isTranscriptionAvailable.value = true;
  alert("Transcription workflow is ready. Use imported subtitles or Mock Cloud ASR for demos.");
}

// 格式化时间函数
function formatTime(seconds: number): string {
  if (!seconds || seconds <= 0) return "00:00:00";
  
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  
  return [h, m, s]
    .map(v => v.toString().padStart(2, '0'))
    .join(':');
}

// Ollama 连接方法
async function connectOllama() {
  ollamaLoading.value = true;
  ollamaError.value = "";
  
  try {
    const result = await window.api.invoke("get-ollama-models", settings.value.ollamaUrl);
    
    if (result.success && Array.isArray(result.models)) {
      ollamaModels.value = result.models;
      ollamaError.value = "";
      
      // 如果当前没有选中模型，自动选择第一个
      if (!settings.value.llmModel && result.models.length > 0) {
        settings.value.llmModel = result.models[0];
      }
    } else {
      ollamaModels.value = [];
      ollamaError.value = result.error || "获取模型列表失败";
    }
  } catch (error) {
    ollamaModels.value = [];
    ollamaError.value = (error as Error).message || "连接 Ollama 服务器失败";
  } finally {
    ollamaLoading.value = false;
  }
}


// Check LLM model installed status
async function checkLlmModelStatus() {
  try {
    console.log("🔍 Checking LLM status...");
    // IPC returns boolean directly now
    const exists = await window.api.invoke("llm-check-model");
    console.log("🔍 LLM Status:", exists);
    llmModelInstalled.value = exists;
    return exists;
  } catch (error) {
    console.error('Failed to check LLM model status:', error);
    llmModelInstalled.value = false;
    return false;
  }
}

// Import local model
async function handleImport() {
  try {
    const success = await window.api.invoke('llm-import-local-model');
    
    if (success) {
      // 2. ✨ 核心修复：导入成功后，立即强制刷新状态
      const installed = await checkLlmModelStatus();
      if (installed) {
        alert("✅ 模型导入成功！状态已刷新。");
      } else {
        alert("⚠️ 导入完成，但检测未通过。请确认为有效的 GGUF 模型。");
      }
    } else {
      console.log("用户取消导入");
    }
  } catch (e) {
    alert("导入出错: " + (e as any).message);
  }
}

// Handle Check Environment (Combined)
async function handleCheckEnvironment() {
  console.log("开始环境检查...");
  
  // 1. Check LLM
  await checkLlmModelStatus();

  // 2. Show Result
  if (llmModelInstalled.value) {
    alert("Workflow ready. Transcription does not require local models. Optional LLM model is installed.");
  } else {
    alert("Workflow ready. Transcription does not require local models. Optional LLM model is not installed.");
  }
}

// Download embedded LLM model
async function downloadLlmModel() {
  llmModelDownloading.value = true;
  llmDownloadProgress.value = 0;
  
  try {
    console.log(`Starting download for gemma2-2b`);
    const result = await window.api.invoke("llm-download-model", "gemma2-2b");
    
    if (!result.success) {
      alert(`模型下载失败: ${result.error || '未知错误'}`);
      llmModelDownloading.value = false;
      llmDownloadProgress.value = 0;
    }
  } catch (error) {
    console.error(`Download failed:`, error);
    alert(`模型下载失败: ${(error as Error).message}`);
    llmModelDownloading.value = false;
    llmDownloadProgress.value = 0;
  }
}

// 关闭模态框
function close() {
  emit("close");
}
</script>

<style scoped>
/* 添加一些自定义样式 */
</style>
