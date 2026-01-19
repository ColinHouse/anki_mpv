<template>
  <div class="inline-flex flex-wrap items-baseline gap-x-0.5 leading-snug">
    <!-- If loading or error, show raw text -->
    <span v-if="!tokens || tokens.length === 0" class="text-gray-800">{{ text }}</span>
    
    <!-- Render Tokens -->
    <template v-else>
      <span 
        v-for="(token, index) in tokens" 
        :key="index"
        @click.stop="handleClick(token)"
        class="
          cursor-pointer 
          hover:bg-blue-100 hover:text-blue-700 hover:rounded-sm 
          transition-colors select-text text-gray-800
        "
        :title="`${token.reading}\n${token.basicForm}`"
      >
        {{ token.surface }}
      </span>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { useSegmentation, type TokenResult } from '../composables/useSegmentation';
import { useDictionary } from '../composables/useDictionary';
import type { SubtitleContext } from '../types';

const props = defineProps<{
  text: string;
  context?: SubtitleContext;
}>();

const { segmentText } = useSegmentation();
const { lookupWord } = useDictionary();

const tokens = ref<TokenResult[]>([]);

const analyze = async () => {
  if (!props.text) {
    tokens.value = [];
    return;
  }
  // Optional: Optimize by caching or preventing spam
  try {
    tokens.value = await segmentText(props.text);
    if (tokens.value.length === 0 && props.text) {
       console.warn("⚠️ Tokenization returned empty for:", props.text);
    }
  } catch (e) {
    console.error("Tokenization failed", e);
    tokens.value = [];
  }
};

const handleClick = (token: TokenResult) => {
  console.log("Clicked token:", token);
  // Prefer basic form for dictionary lookup (e.g. shimau instead of shimatta)
  // If basicForm is '*', fallback to word
  const query = (token.basicForm && token.basicForm !== '*') ? token.basicForm : token.word;
  lookupWord(query, props.context);
};

// Analyze on mount and when text changes
onMounted(analyze);
watch(() => props.text, analyze);
</script>
