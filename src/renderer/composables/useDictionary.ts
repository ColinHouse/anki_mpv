import { ref } from 'vue';
import type { DictionaryResult, SubtitleContext } from '../types';

// Singleton State
const isLoading = ref(false);
const error = ref<string | null>(null);
const currentWord = ref<DictionaryResult | null>(null);
const currentContext = ref<SubtitleContext | null>(null);
const showModal = ref(false);

// LLM State
const llmExplanation = ref<string>("");
const isLLMLoading = ref(false);

export function useDictionary() {
  const lookupWord = async (text: string, context?: SubtitleContext) => {
    if (!text) return;
    
    // Reset State
    isLoading.value = true;
    error.value = null;
    showModal.value = true;
    currentWord.value = null;
    currentContext.value = context || null;
    llmExplanation.value = ""; // Clear old interpretation
    isLLMLoading.value = false;

    try {
      console.log("📖 Looking up:", text);
      const result = await (window as any).api.invoke('lookup-word', text);
      
      if (result) {
        currentWord.value = result;
        
        // 🚀 Auto-trigger removed. 
        // Logic moved to "Manual Trigger" in WordCard.vue.
        // if (context && context.sentenceText) { ... }

      } else {
        error.value = "未找到释义";
      }
    } catch (err) {
      console.error("Lookup failed:", err);
      error.value = "查询出错";
    } finally {
      isLoading.value = false;
    }
  };

  return {
    isLoading,
    error,
    currentWord,
    currentContext,
    showModal,
    lookupWord,
    llmExplanation,
    isLLMLoading
  };
}
