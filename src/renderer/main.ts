import { createApp } from 'vue'
import App from './App.vue'

// 创建 Vue 应用实例
const app = createApp(App)

// 全局错误处理器 - 防止白屏
app.config.errorHandler = (err, instance, info) => {
  console.error("Vue Global Error:", err);
  console.error("Error Info:", info);
  
  // 在页面上显示错误而不是白屏
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = 'color:red; padding:20px; background:#fff; font-family:monospace;';
  errorDiv.innerHTML = `
    <h1 style="color:#d32f2f;">⚠️ App Crashed</h1>
    <h2>Error: ${err instanceof Error ? err.message : String(err)}</h2>
    <pre style="background:#f5f5f5; padding:10px; overflow:auto;">${err instanceof Error ? err.stack : String(err)}</pre>
    <p><strong>Info:</strong> ${info}</p>
  `;
  
  // 只在挂载失败时替换整个body（避免覆盖已渲染的内容）
  if (!document.querySelector('#app > *')) {
    document.body.innerHTML = '';
    document.body.appendChild(errorDiv);
  } else {
    // 如果app已经有内容，就显示在顶部
    const appElement = document.getElementById('app');
    if (appElement) {
      appElement.insertBefore(errorDiv, appElement.firstChild);
    }
  }
};

// 挂载应用到 DOM
app.mount('#app')

// 导出应用实例（可选，用于调试）
export default app

// 添加全局 API 对象类型声明
declare global {
  interface Window {
    api: {
      // ✅ 必须暴露 invoke 才能使用 ipcMain.handle
      invoke: (channel: string, data?: any) => Promise<any>
      
      // 保留原有的 send 和 on
      send?: (channel: string, data: any) => void
      on?: (channel: string, func: (...args: any[]) => void) => (() => void) | void
      removeListener?: (channel: string, func: (...args: any[]) => void) => void
      
      // File operations
      openFile?: () => Promise<string | null>
      getServerPort?: () => Promise<number>
      
      // Audio/Video operations
      extractAudio?: (videoPath: string, startTime?: number, duration?: number) => Promise<string>
      getVideoInfo?: (filePath: string) => Promise<any>
      trimVideo?: (inputPath: string, startTime: number, endTime: number) => Promise<string>
      
      // Legacy local transcription operations
      ensureModel?: () => Promise<any>
      runWhisper?: (audioPath: string, modelPath: string, language: string) => Promise<any>
      runWhisperSegments?: (videoPath: string, language: string, segmentDuration: number) => Promise<any>
      stopWhisper?: () => Promise<void>
      checkWhisperAvailability?: () => Promise<boolean>
      
      // Legacy local transcription event listeners
      onWhisperStatus?: (callback: (event: any, progress: any) => void) => void
      removeWhisperStatusListener?: (callback: (event: any, progress: any) => void) => void
      onWhisperChunkCompleted?: (callback: (event: any, data: any) => void) => void
      removeWhisperChunkCompletedListener?: (callback: (event: any, data: any) => void) => void

      // Provider-based transcription
      importSubtitleTranscript?: (input: any) => Promise<any>
      runMockCloudTranscription?: (input: any) => Promise<any>
      runCloudTranscription?: (input: any) => Promise<any>
      getCachedTranscript?: (input: any) => Promise<any>
      clearTranscriptCache?: () => Promise<any>
      
      // Settings
      getSettings?: () => Promise<any>
      saveSettings?: (settings: any) => Promise<any>
      
      // Models & Cache
      checkModelStatus?: (type: string) => Promise<boolean>
      downloadModel?: (type: string) => Promise<boolean>
      clearTempDir?: () => Promise<boolean>
      getTempSize?: () => Promise<number>
      
      // LLM
      getOllamaModels?: (url: string) => Promise<string[]>
    }
  }
}

// 注意：window.api 对象应该由预加载脚本通过 contextBridge 暴露
// 这里只做类型声明，不重新定义对象，避免覆盖预加载脚本中的实现
