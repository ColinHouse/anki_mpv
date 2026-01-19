import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
  build: {
    rollupOptions: {
      // 关键：将这些依赖排除在打包之外，确保主进程直接通过 require 加载它们
      external: [
        'ffmpeg-static',
        'fluent-ffmpeg',
        'whisper-node',
        'axios',
        'node-llama-cpp',
        // Exclude node-llama-cpp native bindings
        /^@node-llama-cpp\/.*/,
        'child_process', // 内置模块也建议显式排除
        'fs',
        'path',
        'electron'
      ],
    },
  },
});
