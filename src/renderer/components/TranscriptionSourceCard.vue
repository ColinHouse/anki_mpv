<template>
  <section class="bg-white border border-gray-200 rounded-lg shadow-sm p-4 space-y-4">
    <div class="flex items-start justify-between gap-3">
      <div>
        <h2 class="text-base font-semibold text-gray-900">Subtitle Source</h2>
        <p class="text-xs text-gray-500 mt-1">
          Subtitle-first Japanese video learning workflow
        </p>
      </div>
      <span
        :class="[
          'px-2 py-1 rounded-full text-[11px] font-semibold border whitespace-nowrap',
          badgeClass,
        ]"
      >
        {{ providerStatusLabel }}
      </span>
    </div>

    <div class="grid grid-cols-1 gap-3">
      <div class="border border-emerald-200 bg-emerald-50/60 rounded-lg p-3">
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="flex items-center gap-2">
              <h3 class="text-sm font-semibold text-gray-900">Import Subtitle</h3>
              <span class="px-2 py-0.5 rounded-full bg-white text-emerald-700 border border-emerald-200 text-[11px] font-medium">
                Best for stable demos
              </span>
            </div>
            <p class="text-xs text-gray-600 mt-1">
              Load .srt or .vtt subtitles and start learning immediately.
            </p>
          </div>
          <button
            @click="importSubtitle()"
            :disabled="isLoading"
            class="shrink-0 px-3 py-1.5 rounded-md bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50"
          >
            Import .srt/.vtt
          </button>
        </div>
      </div>

      <div class="border border-blue-200 bg-blue-50/70 rounded-lg p-3">
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="flex items-center gap-2">
              <h3 class="text-sm font-semibold text-gray-900">Mock Cloud ASR</h3>
              <span class="px-2 py-0.5 rounded-full bg-white text-blue-700 border border-blue-200 text-[11px] font-medium">
                Demo mode
              </span>
            </div>
            <p class="text-xs text-gray-600 mt-1">
              Generate a sample Japanese transcript without using local GPU or paid APIs.
            </p>
          </div>
          <button
            @click="loadDemoTranscript()"
            :disabled="isLoading"
            class="shrink-0 px-3 py-1.5 rounded-md bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            Start Demo Transcript
          </button>
        </div>
      </div>

      <div class="border border-amber-200 bg-amber-50/70 rounded-lg p-3">
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="flex items-center gap-2">
              <h3 class="text-sm font-semibold text-gray-900">Cloud ASR</h3>
              <span class="px-2 py-0.5 rounded-full bg-white text-amber-700 border border-amber-200 text-[11px] font-medium">
                Coming soon / configurable
              </span>
            </div>
            <p class="text-xs text-gray-600 mt-1">
              Use a remote speech recognition provider when configured.
            </p>
          </div>
          <button
            @click="runCloud(currentVideoPath || undefined)"
            :disabled="isLoading"
            class="shrink-0 px-3 py-1.5 rounded-md bg-white text-amber-800 border border-amber-300 text-xs font-semibold hover:bg-amber-100 disabled:opacity-50"
          >
            Check Cloud ASR
          </button>
        </div>
      </div>
    </div>

    <div class="flex items-center justify-between gap-3 border-t border-gray-100 pt-3">
      <div class="min-w-0">
        <p
          class="text-xs truncate"
          :class="error ? 'text-red-600' : 'text-gray-500'"
          :title="error || progressLabel"
        >
          {{ error || progressLabel }}
        </p>
        <div v-if="isLoading" class="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div class="h-full bg-blue-600 rounded-full animate-pulse" style="width: 72%"></div>
        </div>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <button
          @click="clearTranscript()"
          :disabled="isLoading || subtitles.length === 0"
          class="px-2.5 py-1.5 rounded-md text-xs border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        >
          Clear
        </button>
        <button
          @click="clearTranscriptCache()"
          :disabled="isLoading"
          class="px-2.5 py-1.5 rounded-md text-xs border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        >
          Clear Cache
        </button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useTranscription } from "../composables/useTranscription";
import { useVideoQueue } from "../composables/useVideoQueue";

const {
  importSubtitle,
  loadDemoTranscript,
  runCloud,
  clearTranscript,
  clearTranscriptCache,
  isLoading,
  progressLabel,
  error,
  providerStatusLabel,
  transcriptResult,
  subtitles,
} = useTranscription();

const { currentVideoPath } = useVideoQueue();

const badgeClass = computed(() => {
  if (error.value?.includes("Cloud transcription is not configured")) {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }
  if (transcriptResult.value?.source === "cache") {
    return "bg-purple-50 text-purple-700 border-purple-200";
  }
  if (transcriptResult.value?.source === "imported") {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }
  if (transcriptResult.value?.source === "mock-cloud") {
    return "bg-blue-50 text-blue-700 border-blue-200";
  }
  return "bg-gray-50 text-gray-600 border-gray-200";
});
</script>

