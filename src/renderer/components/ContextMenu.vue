<template>
  <div
    v-if="visible"
    class="fixed bg-white shadow-xl border border-gray-200 rounded-lg z-50 overflow-hidden min-w-[160px] py-1"
    :style="{ top: y + 'px', left: x + 'px' }"
    @click.stop
  >
    <ul class="text-sm">
      <li 
        @click="$emit('action', 'edit')" 
        class="px-4 py-2 hover:bg-gray-100 cursor-pointer flex items-center gap-2 text-gray-700"
      >
        <span>✏️</span> 编辑字幕 / 修改翻译
      </li>
    </ul>
  </div>

  <!-- Click outside to close context menu -->
  <div
    v-if="visible"
    class="fixed inset-0 z-40 bg-transparent"
    @click="$emit('close')"
    @contextmenu.prevent="$emit('close')"
  ></div>
</template>

<script setup lang="ts">
// Props
defineProps<{
  visible: boolean;
  x: number;
  y: number;
}>();

// Emits
const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'action', action: string): void;
}>();
</script>
