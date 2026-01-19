# 🚀 Anki-MPV AI Studio

**本地 AI 驱动的沉浸式日语学习 & 视频“生肉”辅助工具**
**Local AI-Powered Immersive Japanese Learning & Video Translation Assistant**

本项目是一个基于 Electron 开发的桌面应用，旨在通过本地 LLM（大语言模型）和 Whisper 语音识别技术，帮助学习者从日语原声视频中快速提取生词，制作高质量 Anki 卡片，亦可作为“辅助烤生肉”的翻译工作流。

This Electron-based desktop application integrates local LLM and Whisper STT technology to help learners extract vocabulary from native Japanese videos and create high-quality Anki cards. It also serves as a powerful workflow for video translation and "raw" content assistance.

---

## 📂 项目结构 (Project Structure)

### `src/main` (Electron Main Process)
后端核心逻辑，负责系统级操作、AI 模型调用与 IPC 通信。
Backend core logic, handling system operations, AI model inference, and IPC communication.

- **`main.ts`**: 应用入口，负责窗口创建与生命周期管理。
  Application entry point, managing window creation and lifecycle.
- **`services/`**: 核心业务服务模块。
  Core business service modules.
  - `segmentation-service.ts`: **Kuromoji 分词服务**，负责日语分词与词性标注。
    **Kuromoji Segmentation Service**, responsible for Japanese tokenization and POS tagging.
  - `llm-service.ts`: **本地 LLM 服务** (llama.cpp)，处理深度语法分析与问答。
    **Local LLM Service** (llama.cpp), handling deep grammatical analysis and QA.
  - `anki-service.ts`: **Anki 连接服务**，负责并通过 AnkiConnect API 创建卡片。
    **Anki Connect Service**, managing card creation via AnkiConnect API.
- **`whisper/`**: **语音识别模块**，集成 Whisper.cpp 进行离线语音转文字。
  **Speech Recognition Module**, integrating Whisper.cpp for offline STT.
  - `whisper-runner.ts`: Whisper 进程管理器。 / Whisper process manager.
- **`ipc/`**: **IPC 处理程序**，处理前端发来的各类请求（文件、设置、LLM 等）。
  **IPC Handlers**, handling various requests from frontend (files, settings, LLM, etc.).
- **`video-server.ts`**: **本地流媒体服务器**，用于向前端播放器串流视频文件。
  **Local Streaming Server**, for streaming video files to the frontend player.

### `src/renderer` (Electron Renderer Process)
前端 UI 界面，基于 Vue 3 + Tailwind CSS 构建。
Frontend UI, built with Vue 3 + Tailwind CSS.

- **`components/`**: UI 组件库。 / UI Components.
  - `VideoPlayer.vue`: **视频播放器**，集成 mpv 或相关播放核心，支持快捷键。
    **Video Player**, integrated playback core with shortcut support.
  - `SubtitleList.vue`: **交互式字幕列表**，支持双击查词、实时滚动。
    **Interactive Subtitle List**, supporting double-click dictionary lookup and auto-scrolling.
  - `TokenizedText.vue`: **分词显示组件**，将句子拆解为可点击的单词单元。
    **Tokenized Text Component**, breaking sentences into clickable word units.
  - `WordCard.vue`: **单词详情卡片**，展示释义、读音及 AI 分析结果。
    **Word Detail Card**, displaying definitions, readings, and AI analysis.
- **`composables/`**: 组合式函数 (Hooks)，管理共享状态。 / Composables (Hooks) for shared state.
  - `useWhisper.ts`: 管理语音识别任务状态与进度。 / Manages STT task status and progress.
  - `useSegmentation.ts`: 前端分词逻辑封装。 / Frontend tokenization logic encapsulation.

---

## 🌟 核心功能 (Key Features)

### 1. 离线语音识别 (Offline Whisper STT)
- **功能**: 自动提取视频中的人声并转换为带时间轴的日语字幕。
  **Function**: Automatically extracts voice from video and converts it into Japanese subtitles with timestamps.
- **技术**: 基于 `whisper.cpp`，支持 GPU 加速，无需上传文件。
  **Tech**: Powered by `whisper.cpp`, supports GPU acceleration, no file upload required.

### 2. 交互式分词与查词 (Interactive Tokenization & Dictionary)
- **功能**: 鼠标悬停或点击字幕中的任意单词，即可查看读音、原型和词性。
  **Function**: Hover or click any word in subtitles to see its reading, basic form, and part of speech.
- **技术**: 使用 `Kuromoji` 进行本地形态素分析，精准度高。
  **Tech**: Uses `Kuromoji` for local morphological analysis with high precision.

### 3. AI 语法分析 (AI Grammatical Analysis)
- **功能**: 选中难懂的长难句，本地 LLM (Gemma-2b/Llama-3) 会为你剖析语法结构。
  **Function**: Select complex sentences, and the local LLM will analyze the grammatical structure for you.
- **优势**: 保护隐私，无网络延迟，完全免费。
  **Pros**: Privacy-focused, no network latency, and completely free.

### 4. Anki 一键制卡 (One-Click Anki Card Creation)
- **功能**: 自动通过 AnkiConnect 将当前视频截图、音频片段、原句、释义同步到 Anki。
  **Function**: Automatically syncs screenshots, audio clips, sentences, and definitions to Anki via AnkiConnect.

---

## ⚠️ 性能提示 (Performance Notes)

由于本项目完全运行在**本地环境**，其处理速度高度依赖于您的硬件性能：
Since this project runs entirely **locally**, processing speed is highly dependent on your hardware:

1. **语音识别 (Whisper)**: 建议使用 NVIDIA 显卡以获得最佳速度。纯 CPU 模式在长视频上会较慢。
   **Speech Recognition**: NVIDIA GPU recommended for best speeds. CPU-only mode will be slower on long videos.
2. **AI 模型 (LLM)**: 需要至少 4GB 显存 (VRAM) 以流畅运行 2B/4B 量化模型。
   **AI Models**: At least 4GB VRAM required to smoothly run 2B/4B quantized models.

---

## 🤝 贡献与 GPU 加速 (Contribution & GPU Support)

目前代码默认以 **CPU 模式** 运行，暂未显式启用 GPU 加速配置（如 `node-llama-cpp` 的 `gpuLayers` 或 Whisper 的 CUDA/Metal 标志）。
The current codebase defaults to **CPU mode** and does not explicitly enable GPU acceleration commands (e.g., `gpuLayers` for `node-llama-cpp` or CUDA/Metal flags for Whisper).

**后续可以优化！ / We Need Your Help!**
如果您拥有 NVIDIA (CUDA) 或 Apple Silicon (Metal) 设备，并了解如何配置 `llama.cpp` / `whisper.cpp` 的 GPU 加速，欢迎提交 PR 优化以下文件：
If you have a GPU and know how to enable acceleration for `llama.cpp`/`whisper.cpp`, please consider contributing to:

- `src/main/llm-service.ts`: 添加 `gpuLayers` 选项 / Add `gpuLayers` option.
- `src/main/whisper/whisper-runner.ts`: 适配 GPU 相关的 CLI 参数 / Adapt CLI arguments for GPU.

---

## 📦 快速开始 (Quick Start)

1. **安装依赖 / Install Dependencies**:
   ```bash
   npm install
   ```

2. **准备模型 / Model Setup**:
   - 将 Whisper 模型 (e.g. `ggml-medium.bin`) 放入 `resources/models/whisper/`。
   - 将 LLM 模型 (e.g. `gemma-2b-it-q4_k_m.gguf`) 放入 `resources/models/llm/`。
   - *Place Whisper models in `resources/models/whisper/` and LLM models in `resources/models/llm/`.*

3. **Anki 设置 / Anki Setup**:
   - 安装插件 / Install Plugin: 代码 `2055492159` (AnkiConnect)。
   - 配置 / Config: `Tools` -> `Add-ons` -> `AnkiConnect` -> `Config`:
     ```json
     {
       "webCorsOriginList": ["*"]
     }
     ```
   - **保持运行 / Keep Active**: 使用本软件时请保持 Anki 打开。 / Keep Anki running while using this app.

4. **启动应用 / Start Application**:
   ```bash
   npm run start
   ```
