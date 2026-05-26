```html
<template>
  <!-- Modal Overlay -->
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4" v-if="true">
    <div class="absolute inset-0 bg-black bg-opacity-30" @click="$emit('close')"></div>

    <!-- Modal Content -->
    <div class="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]">
      <!-- Loading State -->
      <div v-if="loading" class="flex flex-col items-center justify-center py-12">
        <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-3"></div>
        <p class="text-gray-500 text-sm">正在查询...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="flex flex-col items-center justify-center py-12 px-6 text-center">
        <div class="text-red-500 bg-red-100 p-3 rounded-full mb-3">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <p class="text-gray-800 font-medium mb-1">查询失败</p>
        <p class="text-gray-500 text-sm">{{ error }}</p>
      </div>

      <!-- Data Content -->
      <div v-else-if="data" class="flex flex-col h-full overflow-hidden">
        <!-- Header (Refactored) -->
        <div class="p-8 pb-4 border-b border-gray-100 bg-gray-50">
          <div class="flex justify-between items-start mb-6">
            
            <!-- Left: Word Info -->
            <div class="flex-1 min-w-0 pr-4">
              <h2 class="text-4xl font-bold text-gray-800 break-words leading-tight">{{ data.word }}</h2>
              <div class="flex items-center gap-3 mt-2">
                 <span class="text-lg text-blue-600 font-medium whitespace-nowrap">{{ data.reading }}</span>
                 <span v-if="data.pronunciation" class="text-sm text-gray-400 font-mono bg-white border border-gray-200 px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap">{{ data.pronunciation }}</span>
                 <!-- TTS Button -->
                 <button 
                  @click="playTTS"
                  class="text-gray-400 hover:text-blue-500 p-1 rounded-full hover:bg-white transition-colors flex-shrink-0"
                  title="朗读"
                 >
                   <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  </svg>
                 </button>
              </div>
            </div>

            <!-- Right: Actions & Logo -->
            <div class="flex flex-col items-end gap-2 shrink-0">
               <!-- Close Icon -->
               <button @click="$emit('close')" class="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 mb-2">
                   <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
               </button>

                <!-- Anki Add Button -->
                <div v-if="context" class="flex flex-col items-end gap-2">
                      <!-- Deck Selector -->
                      <select 
                        v-if="deckList.length > 0"
                        v-model="selectedDeck" 
                        class="text-xs border border-gray-200 rounded px-2 py-1 bg-white focus:border-blue-500 outline-none cursor-pointer max-w-[150px] truncate"
                      >
                        <option v-for="deck in deckList" :key="deck" :value="deck">{{ deck }}</option>
                      </select>
                      <div v-else class="text-xs text-red-400">
                        AnkiConnect is not available. Please open Anki and enable the AnkiConnect add-on.
                      </div>

                      <button 
                         @click="handleAddToAnki" 
                         class="flex items-center gap-2 px-3 py-1.5 bg-[#0d6efd] text-white rounded-lg shadow hover:bg-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                         :disabled="isAdding || addSuccess || deckList.length === 0"
                         title="保存到 Anki"
                       >
                         <span class="font-bold text-lg leading-none" style="margin-bottom:2px">★</span>
                         <span v-if="addSuccess">Card Created</span>
                         <span v-else-if="isAdding">...</span>
                         <span v-else>Create Anki Card</span>
                      </button>
                </div>
            </div>

          </div>

          <!-- Error & Manual Repair -->
          <div v-if="ankiError" class="mt-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg">
             <div class="flex items-center gap-2">
               <span>⚠️ {{ ankiError }}</span>
             </div>
             <button 
                v-if="ankiError.includes('model') || ankiError.includes('deck') || ankiError.includes('Connect') || ankiError.includes('连接失败')"
                @click="retryInit"
                class="mt-2 text-xs text-white bg-red-500 px-3 py-1.5 rounded hover:bg-red-600 shadow-sm flex items-center gap-1"
              >
                🛠️ 尝试自动修复 (初始化 Anki)
              </button>
          </div>

        </div>

          <!-- Definitions -->
          <div class="space-y-2 p-8 pt-6"> <!-- Added padding for body -->
            <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">释义</h3>
            <ul class="space-y-2">
              <li v-for="(def, idx) in data.definitions" :key="idx" class="flex gap-2">
                <span class="text-blue-400 mt-1.5 h-1.5 w-1.5 rounded-full bg-blue-400 flex-shrink-0"></span>
                <span class="text-gray-700 leading-relaxed">{{ def }}</span>
              </li>
            </ul>

          <!-- AI Explanation (Manual Trigger) -->
          <div class="mt-6 bg-blue-50/50 rounded-xl border border-blue-100 overflow-hidden">
              <div class="px-4 py-3 bg-blue-100/50 flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="text-lg">🤖</span>
                  <span class="text-sm font-bold text-blue-800">AI 语境深度解析</span>
                </div>
                <button 
                  v-if="!llmExplanation && !isLLMLoading"
                  @click="triggerAI"
                  class="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md transition-colors shadow-sm flex items-center gap-1"
                >
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                  开始分析
                </button>
              </div>
              <div v-if="!llmExplanation && !isLLMLoading" class="text-sm text-gray-500 italic text-center py-2">
                  点击上方按钮，让本地 AI 老师为您解析当前语境下的微妙含义...
              </div>
              <div v-if="isLLMLoading" class="flex flex-col items-center justify-center py-4 space-y-3">
                  <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  <span class="text-xs text-blue-600 animate-pulse">AI 正在阅读句子并思考... (首次加载可能需要几秒)</span>
              </div>
              <div v-if="llmExplanation" class="px-4 pb-4">
                  <h4 class="text-xs font-bold text-gray-500 uppercase mb-2 mt-2">AI 深度解析</h4>
                  <div 
                    class="mt-1 bg-white/50 backdrop-blur-sm rounded-lg border border-blue-200/50 shadow-inner p-4 transition-all duration-300"
                    style="max-height: 350px; min-height: 120px;" 
                  >
                     <div 
                       class="prose prose-sm prose-blue max-w-none text-gray-800 overflow-y-auto pr-2 custom-scrollbar" 
                       style="max-height: 320px;"
                       v-html="renderMarkdown(llmExplanation)"
                     ></div>
                  </div>
              </div>
          </div>
          
          <!-- Examples -->
          <div v-if="data.examples && data.examples.length > 0" class="space-y-3 pt-6">
            <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">例句</h3>
            <div 
              v-for="(ex, idx) in data.examples" 
              :key="idx" 
              class="bg-gray-50 rounded-lg p-3 border border-gray-100 hover:border-blue-100 transition-colors"
            >
              <p class="text-sm font-medium text-gray-900 mb-1 leading-relaxed">{{ ex.japanese }}</p>
              <p class="text-xs text-gray-500">{{ ex.translation }}</p>
            </div>
          </div>

          <!-- Source Sentence Preview -->
          <div v-if="context" class="space-y-2 pt-6 border-t border-gray-100 mt-4">
             <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">来源句子</h3>
             <p class="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg border border-gray-100 leading-relaxed" v-html="formattedSentence"></p>
             
             <!-- 翻译显示 -->
             <div v-if="context.sentenceTranslation" class="text-sm text-blue-800 bg-blue-50 p-3 rounded-lg border border-blue-100 flex items-start gap-2">
                <span class="font-bold shrink-0 text-blue-600/80">译:</span>
                <span>{{ context.sentenceTranslation }}</span>
             </div>
          </div>
          </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import type { DictionaryResult, SubtitleContext } from '../types';
import { useAnki } from '../composables/useAnki';
import { useDictionary } from '../composables/useDictionary';
import MarkdownIt from 'markdown-it';

// 初始化 Markdown 渲染器
const md = new MarkdownIt({
  breaks: true, // 换行符转为 <br>
  html: false   // 禁用 HTML 标签以防注入
});

// 辅助函数：渲染 Markdown
const renderMarkdown = (text: string) => {
  if (!text) return '';
  return md.render(text);
};

const props = defineProps<{
  loading: boolean;
  data: DictionaryResult | null;
  error: string | null;
  context?: SubtitleContext | null;
}>();

defineEmits(['close']);

const { isAdding, addSuccess, error: ankiError, addToAnki, deckList, selectedDeck, fetchDecks } = useAnki();
const { llmExplanation, isLLMLoading } = useDictionary();

onMounted(() => {
    fetchDecks();
});

const handleAddToAnki = async () => {
    if (isAdding.value) return; // Debounce

    if (props.data && props.context) {
        // Pass LLM explanation to addToAnki
        await addToAnki(props.data, props.context, llmExplanation.value);
        
        // Enhance error feedback
        if (ankiError.value) {
            console.error("Anki Error Value:", ankiError.value);
            if (ankiError.value.includes("unreachable") || ankiError.value.includes("Failed to fetch") || ankiError.value.includes("Network Error")) {
                ankiError.value = "连接失败 (请确保 Anki 已运行)";
            } else if (ankiError.value.includes("model") || ankiError.value.includes("deck")) {
                ankiError.value = "模板创建失败 (请重启应用)";
            }
        }
    }
}

// Manual Retry
const retryInit = async () => {
  if (isAdding.value) return; // prevent double click
  
  isAdding.value = true;
  ankiError.value = null; // Clear previous error
  
  try {
     const res = await (window as any).api.invoke('init-anki');
     if (res.success) {
         console.log("✅ Manual Anki repair successful");
         handleAddToAnki(); // Retry adding
     } else {
         ankiError.value = "修复失败: " + (res.error || "Unknown error");
         isAdding.value = false;
     }
  } catch (e: any) {
      ankiError.value = "修复异常: " + e.message;
      isAdding.value = false;
  }
};

// Text-to-Speech
const playTTS = () => {
    if (!props.data?.word) return;
    const utterance = new SpeechSynthesisUtterance(props.data.word);
    utterance.lang = 'ja-JP';
    window.speechSynthesis.speak(utterance);
};

const triggerAI = async () => {
  if (!props.context?.sentenceText || !props.data?.word) return;
  
  isLLMLoading.value = true;
  llmExplanation.value = ""; // 清空旧数据
  
  try {
    // 调用后端
    const result = await (window as any).api.invoke('explain-word', {
      word: props.data.word,
      sentence: props.context.sentenceText
    });
    llmExplanation.value = result;
  } catch (e) {
    console.error(e);
    llmExplanation.value = "❌ AI 思考中断，请重试。";
  } finally {
    isLLMLoading.value = false;
  }
};

// Sentence Highlighting
const formattedSentence = computed(() => {
    if (!props.context?.sentenceText || !props.data?.word) {
        return props.context?.sentenceText || '';
    }
    const word = props.data.word;
    // Simple replace - can be improved with regex to handle conjugations if segmenter provides info
    // For now, escaping regex special chars in word might be needed but simple replace is step 1.
    return props.context.sentenceText.replace(
        new RegExp(word, 'g'), 
        `<b class="text-blue-600">${word}</b>`
    );
});
</script>
```
