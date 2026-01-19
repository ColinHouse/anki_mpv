import { createApp } from 'vue'

// 创建一个简单的 Vue 应用
const app = createApp({
  data() {
    return {
      videoSrc: null,
      videoInfo: '',
      selectedFile: null
    }
  },
  methods: {
    async selectVideo() {
      try {
        if (window.api && window.api.openFile) {
          const filePath = await window.api.openFile()
          if (filePath) {
            this.videoSrc = filePath
            const fileName = filePath.split('/').pop() || filePath.split('\\').pop() || 'Unknown'
            this.videoInfo = fileName
            console.log('Selected video:', filePath)
          }
        } else {
          console.warn('API not available. Make sure you are running in Electron environment.')
        }
      } catch (error) {
        console.error('Error selecting video:', error)
        this.videoInfo = '选择视频时出错'
      }
    },
    onVideoLoaded() {
      console.log('Video loaded successfully')
    },
    onVideoError(error: Event) {
      console.error('Video loading error:', error)
      this.videoInfo = '视频加载失败'
      this.videoSrc = null
    }
  },
  template: `
    <div class="app">
      <header class="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 shadow-lg">
        <h1 class="text-3xl font-bold text-center">Vue 3 + Tailwind CSS v4</h1>
        <p class="text-center mt-2 text-blue-100">Electron Forge Template</p>
      </header>
      
      <main class="container mx-auto p-6">
        <!-- 视频播放区域 -->
        <div class="bg-white rounded-lg shadow-md p-6 mb-6">
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-xl font-semibold text-gray-800">视频播放器</h2>
            <button 
              @click="selectVideo"
              class="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              📁 选择视频
            </button>
          </div>
          
          <div class="aspect-video bg-gray-900 rounded-lg overflow-hidden">
            <video 
              v-if="videoSrc"
              :src="videoSrc" 
              controls 
              class="w-full h-full object-contain"
              @loadedmetadata="onVideoLoaded"
              @error="onVideoError"
            ></video>
            <div v-else class="w-full h-full flex items-center justify-center text-gray-400">
              <div class="text-center">
                <div class="text-6xl mb-4">🎬</div>
                <p class="text-lg">请选择一个视频文件开始播放</p>
              </div>
            </div>
          </div>
          
          <div v-if="videoInfo" class="mt-4 p-3 bg-gray-50 rounded-lg">
            <p class="text-sm text-gray-600">当前视频: {{ videoInfo }}</p>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="bg-white rounded-lg shadow-md p-6">
            <h2 class="text-xl font-semibold mb-4 text-gray-800">Vue 3 Features</h2>
            <ul class="space-y-2 text-gray-600">
              <li class="flex items-center">
                <span class="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                Composition API
              </li>
              <li class="flex items-center">
                <span class="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                Reactive State
              </li>
              <li class="flex items-center">
                <span class="w-2 h-2 bg-purple-500 rounded-full mr-2"></span>
                Component System
              </li>
            </ul>
          </div>
          
          <div class="bg-white rounded-lg shadow-md p-6">
            <h2 class="text-xl font-semibold mb-4 text-gray-800">Tailwind CSS v4</h2>
            <ul class="space-y-2 text-gray-600">
              <li class="flex items-center">
                <span class="w-2 h-2 bg-pink-500 rounded-full mr-2"></span>
                Utility-First CSS
              </li>
              <li class="flex items-center">
                <span class="w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
                Responsive Design
              </li>
              <li class="flex items-center">
                <span class="w-2 h-2 bg-red-500 rounded-full mr-2"></span>
                Dark Mode Support
              </li>
            </ul>
          </div>
        </div>
        
        <div class="mt-8 bg-gradient-to-r from-green-500 to-blue-500 rounded-lg p-6 text-white">
          <h2 class="text-2xl font-bold mb-2">Ready to Develop!</h2>
          <p class="text-green-100">您的 Electron 应用已配置好 Vue 3 和 Tailwind CSS v4，支持本地视频播放。</p>
        </div>
      </main>
    </div>
  `
})

// 挂载应用
app.mount('#app')

// 导出应用实例（可选，用于调试）
export default app
