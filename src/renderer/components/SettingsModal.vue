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
          <!-- Tab 1: 模型管理 -->
          <div v-if="activeTab === 'models'" class="space-y-4">
            <h3 class="text-lg font-medium">模型管理</h3>

            <!-- GPU 开关 (已移除) -->

            <!-- 模型卡片 -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div
                v-for="model in models"
                :key="model.type"
                class="border rounded-lg p-4"
              >
                <h4 class="font-medium">{{ model.name }}</h4>
                <p class="text-sm text-gray-600 mb-2">
                  {{ model.description }}
                </p>

                <!-- 状态显示 -->
                <div class="flex items-center justify-between mb-3">
                  <span
                    :class="[
                      'px-2 py-1 rounded text-xs font-medium',
                      model.status === 'downloaded'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800',
                    ]"
                  >
                    {{ model.status === "downloaded" ? "已下载" : "未下载" }}
                  </span>

                  <!-- 下载进度 -->
                  <div
                    v-if="model.downloading"
                    class="w-full bg-gray-200 rounded-full h-2"
                  >
                    <div
                      class="bg-blue-600 h-2 rounded-full"
                      :style="{ width: model.progress + '%' }"
                    ></div>
                  </div>
                </div>

                <!-- 操作按钮 -->
                <div class="flex gap-2">
                  <button
                    v-if="model.status === 'not_downloaded'"
                    @click="downloadModel(model.type)"
                    :disabled="model.downloading"
                    class="flex-1 bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 disabled:opacity-50"
                  >
                    {{ model.downloading ? "下载中..." : "下载" }}
                  </button>

                  <button
                    v-if="model.status === 'downloaded'"
                    @click="setActiveModel(model.type)"
                    :class="[
                      'flex-1 px-3 py-1 rounded',
                      settings.activeModel === model.type
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300',
                    ]"
                  >
                    {{
                      settings.activeModel === model.type
                        ? "当前默认"
                        : "设为默认"
                    }}
                  </button>

                  <button
                    v-if="model.status === 'downloaded'"
                    @click="deleteModel(model.type)"
                    class="px-3 py-1 rounded bg-red-500 text-white hover:bg-red-600"
                  >
                    删除
                  </button>
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
          <div>• Whisper可用: {{ isWhisperAvailable ? "是" : "否" }}</div>
          <div>• 当前文件: {{ selectedFile || "未选择" }}</div>
          <div>• 视频时长: {{ formatTime(videoDuration) }}</div>
        </div>
        <div class="flex space-x-2">
          <button
            @click="handleCheckEnvironment"
            class="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            检查环境
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

interface Model {
  type: "base" | "small" | "medium";
  name: string;
  description: string;
  status: "not_downloaded" | "downloaded";
  downloading: boolean;
  progress: number;
}

const props = defineProps<{
  show: boolean;
  currentFile?: string;
  videoDuration?: number;
  isWhisperReady?: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();

// 状态管理（从 App.vue 传递或通过事件通信）
const selectedFile = ref<string | null>(null);
const selectedFilePath = ref<string | null>(null);
const videoDuration = ref<number>(0);
const isWhisperAvailable = ref(false);

// 监听 props 变化，更新本地状态
watch(() => props.currentFile, (newVal) => {
  selectedFile.value = newVal;
});

watch(() => props.videoDuration, (newVal) => {
  videoDuration.value = newVal || 0;
});

watch(() => props.isWhisperReady, (newVal) => {
  isWhisperAvailable.value = newVal || false;
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

const models = ref<Model[]>([
  {
    type: "base",
    name: "Base",
    description: "基础模型，体积较小",
    status: "not_downloaded",
    downloading: false,
    progress: 0,
  },
  {
    type: "small",
    name: "Small",
    description: "小模型，平衡速度与精度",
    status: "not_downloaded",
    downloading: false,
    progress: 0,
  },
  {
    type: "medium",
    name: "Medium",
    description: "中等模型，精度更高",
    status: "not_downloaded",
    downloading: false,
    progress: 0,
  },
]);

const tabs = [
  { id: "models", name: "模型" },
  { id: "storage", name: "存储" },
  { id: "lab", name: "实验室" },
];

const activeTab = ref("models");

// 初始化
onMounted(() => {
  loadSettings();
  checkModelStatus();
  getTempSize();
  
  // 监听下载进度 (修复参数签名)
  // 注意：这里只有一个参数 data，没有 event！
  window.api.on('model-download-progress', (data: any) => {
    console.log('收到进度:', data); // 调试日志
    if (!data || !data.modelType) return;

    const { modelType, progress } = data;
    // 更新对应模型的下载状态
    const model = models.value.find(m => m.type === modelType);
    if (model) {
      model.downloading = true;
      model.progress = progress;

      // 下载完成
      if (progress >= 100) {
        model.downloading = false;
        model.status = "downloaded";
        checkModelStatus(); // 刷新一下状态
      }
    }
  });
  
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

// 检查模型状态
async function checkModelStatus() {
  for (const model of models.value) {
    try {
      const exists = await window.api.invoke("check-model-status", model.type);
      model.status = exists ? "downloaded" : "not_downloaded";
    } catch (error) {
      console.error(`检查模型 ${model.type} 状态失败:`, error);
    }
  }
}

// 下载模型
async function downloadModel(type: "base" | "small" | "medium") {
  const model = models.value.find((m) => m.type === type);
  if (!model) return;

  // 立即将状态设为 downloading 并显示进度条容器
  model.downloading = true;
  model.progress = 0;
  model.status = "not_downloaded"; // 确保状态正确

  try {
    const result = await window.api.invoke("download-model", type);
    if (result) {
      // 下载完成即视为安装成功（后端直接写文件到 resources/models）
      model.status = "downloaded";
      model.downloading = false;
      model.progress = 100;
    } else {
      // 下载失败，重置状态
      model.downloading = false;
      model.progress = 0;
    }
  } catch (error) {
    console.error(`下载模型 ${type} 失败:`, error);
    model.downloading = false;
    model.progress = 0;
  }
}

// 设置活跃模型
async function setActiveModel(type: "base" | "small" | "medium") {
  settings.value.activeModel = type;
  // ✅ 修复：剥离 Proxy 包装，避免 IPC 克隆错误
  const plainSettings = JSON.parse(JSON.stringify(settings.value));
  await window.api.invoke("save-settings", plainSettings);
}

// 删除模型
async function deleteModel(type: "base" | "small" | "medium") {
  const model = models.value.find((m) => m.type === type);
  if (!model) return;

  try {
    // 这里需要添加删除模型文件的 IPC 调用
    // 暂时先标记为未下载
    model.status = "not_downloaded";
  } catch (error) {
    console.error(`删除模型 ${type} 失败:`, error);
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
  try {
    console.log("开始检查环境...");

    const modelResult = await window.api.invoke("ensure-model");
    if (!modelResult) {
      alert("模型检查失败，请检查网络连接");
      return;
    }

    if (selectedFilePath.value) {
      const audioResult = await window.api.invoke(
        "extract-audio",
        selectedFilePath.value
      );
      if (!audioResult?.success) {
        alert(`音频提取失败: ${audioResult?.error || "未知错误"}`);
        return;
      }
    }

    const whisperResult = await window.api.invoke("check-whisper-availability");
    if (whisperResult?.available) {
      isWhisperAvailable.value = true;
      console.log("Whisper可用");
    } else {
      isWhisperAvailable.value = false;
      alert(
        `Whisper不可用: ${whisperResult?.error || "请检查Whisper可执行文件"}`
      );
    }

    // ✅ Show success alert
    console.log("✅ 环境检查完成，所有功能正常");
    alert("环境检查正常，所有功能就绪！");
  } catch (error) {
    console.error("环境检查失败:", error);
    alert(`环境检查失败: ${(error as Error).message}`);
  }
}

// 检查模型
async function checkModel() {
  try {
    const result = await window.api.invoke("ensure-model");
    if (result) {
      alert("模型检查成功！");
    } else {
      alert("模型检查失败，请检查网络连接");
    }
  } catch (error) {
    console.error("模型检查失败:", error);
    alert(`模型检查失败: ${(error as Error).message}`);
  }
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
  
  // 2. Original Whisper check logic (simplified)
  let whisperMsg = "";
  try {
      const whisperResult = await window.api.invoke("check-whisper-availability");
      isWhisperAvailable.value = whisperResult?.available || false;
      whisperMsg = isWhisperAvailable.value ? "✅ Whisper 服务可用" : "❌ Whisper 服务不可用";
  } catch (e) {
      whisperMsg = "❌ Whisper 检查失败";
  }

  // 3. Show Result
  if (llmModelInstalled.value) {
    alert(`✅ 环境正常：模型已安装。\n路径: resources/models/gemma-2-2b-it.Q4_K_M.gguf\n\n${whisperMsg}`);
  } else {
    alert(`❌ 环境异常：未检测到 LLM 模型文件。\n请点击'导入本地文件'或'下载'。\n\n${whisperMsg}`);
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
