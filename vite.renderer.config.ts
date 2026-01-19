import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
  plugins: [
    // 动态导入 Vue 插件以避免 ESM 问题
    (async () => {
      const { default: vue } = await import('@vitejs/plugin-vue');
      return vue();
    })()
  ],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
