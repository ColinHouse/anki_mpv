<template>
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div class="bg-white rounded-xl shadow-xl p-6 w-[500px] animate-fade-in">
      <h3 class="text-lg font-bold mb-4 text-gray-800">✏️ 编辑字幕</h3>
      
      <div class="space-y-4">
        <div>
          <label class="block text-xs text-gray-500 mb-1">日语原文</label>
          <textarea 
            v-model="localText" 
            rows="3" 
            class="w-full border rounded p-2 text-sm focus:ring-2 ring-blue-500 outline-none"
          ></textarea>
        </div>
        <div>
          <label class="block text-xs text-gray-500 mb-1">中文翻译</label>
          <textarea 
            v-model="localTrans" 
            rows="2" 
            class="w-full border rounded p-2 text-sm focus:ring-2 ring-blue-500 outline-none"
          ></textarea>
        </div>
      </div>

      <div class="flex justify-end gap-2 mt-6">
        <button 
          @click="$emit('close')" 
          class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm transition-colors"
        >
          取消
        </button>
        <button 
          @click="handleSave" 
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm shadow-sm transition-colors"
        >
          保存修改
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{
  initialText: string;
  initialTrans: string;
}>();

const emit = defineEmits(['close', 'save']);

const localText = ref(props.initialText);
const localTrans = ref(props.initialTrans);

const handleSave = () => {
  emit('save', { text: localText.value, translation: localTrans.value });
};
</script>

<style scoped>
.animate-fade-in {
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}
</style>
