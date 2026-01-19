const { defineConfig } = require('vite');

// https://vitejs.dev/config
module.exports = defineConfig({
  plugins: [
    // 动态导入 Vue 插件以避免 ESM 问题
    async () => {
      const { default: vue } = await import('@vitejs/plugin-vue');
      return vue();
    }
  ],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  optimizeDeps: {
    include: ['vue']
  }
});
