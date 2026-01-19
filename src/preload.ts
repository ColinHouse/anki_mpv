// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from 'electron'

// 预留接口：暴露一个名为 api 的对象，包含 openFile 和 getServerPort 方法
contextBridge.exposeInMainWorld('api', {
  // 保留原有的 send 和 on
  send: (channel: string, data: any) => ipcRenderer.send(channel, data),
  on: (channel: string, func: (...args: any[]) => void) => {
    const subscription = (_event: any, ...args: any[]) => func(...args);
    ipcRenderer.on(channel, subscription);
    // 返回清理函数（可选，视你之前的实现而定）
    return () => ipcRenderer.removeListener(channel, subscription);
  },
  // ✅ 新增：必须暴露 invoke 才能使用 ipcMain.handle
  invoke: (channel: string, data?: any) => ipcRenderer.invoke(channel, data),
  
  // 如果之前有 removeListener 也请保留
  removeListener: (channel: string, func: (...args: any[]) => void) => {
    ipcRenderer.removeListener(channel, func);
  },

  // 原有的方法
  openFile: () => ipcRenderer.invoke('open-file-dialog'),
  getServerPort: () => ipcRenderer.invoke('get-server-port'),
  extractAudio: (videoPath: string, startTime?: number, duration?: number) => ipcRenderer.invoke('extract-audio', videoPath, startTime, duration),
  ensureModel: () => ipcRenderer.invoke('ensure-model'),
  runWhisper: (audioPath: string, modelPath: string, language: string) => ipcRenderer.invoke('run-whisper', audioPath, modelPath, language),
  runWhisperSegments: (videoPath: string, language: string, segmentDuration: number) => ipcRenderer.invoke('run-whisper-segments', videoPath, language, segmentDuration),
  stopWhisper: () => ipcRenderer.invoke('stop-whisper'),
  checkWhisperAvailability: () => ipcRenderer.invoke('check-whisper-availability'),
  getVideoInfo: (filePath: string) => ipcRenderer.invoke('get-video-info', filePath),
  trimVideo: (inputPath: string, startTime: number, endTime: number) => ipcRenderer.invoke('trim-video', inputPath, startTime, endTime),
  onWhisperStatus: (callback: (event: any, progress: any) => void) => {
    ipcRenderer.on('whisper-status', callback);
  },
  removeWhisperStatusListener: (callback: (event: any, progress: any) => void) => {
    ipcRenderer.removeListener('whisper-status', callback);
  },
  onWhisperChunkCompleted: (callback: (event: any, data: any) => void) => {
    ipcRenderer.on('whisper-chunk-completed', callback);
  },
  removeWhisperChunkCompletedListener: (callback: (event: any, data: any) => void) => {
    ipcRenderer.removeListener('whisper-chunk-completed', callback);
  },
  // 设置相关
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings: any) => ipcRenderer.invoke('save-settings', settings),
  // 模型与缓存
  checkModelStatus: (type: string) => ipcRenderer.invoke('check-model-status', type),
  downloadModel: (type: string) => ipcRenderer.invoke('download-model', type),
  clearTempDir: () => ipcRenderer.invoke('clear-temp-dir'),
  getTempSize: () => ipcRenderer.invoke('get-temp-size'),
  // LLM 相关
  getOllamaModels: (url: string) => ipcRenderer.invoke('get-ollama-models', url)
})
