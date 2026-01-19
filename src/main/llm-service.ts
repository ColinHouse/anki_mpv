import { getModelPath } from "./ensureModel";

/**
 * LLM Service using embedded node-llama-cpp
 * No external Ollama dependency required
 * 
 * Note: Uses dynamic import to load node-llama-cpp (ESM module with top-level await)
 */

export class LLMService {
  private llama: any = null;
  private model: any = null;
  private context: any = null;
  private session: any = null;
  private isInitializing = false;
  private currentModelName: string | null = null;

  /**
   * Initialize and load the model (lazy loading)
   * @param modelName - Model name (e.g., 'gemma2-2b')
   */
  async initModel(modelName: string = 'gemma2-2b'): Promise<void> {
    // Skip if already loaded
    if (this.model && this.currentModelName === modelName) {
      console.log(`🧠 LLM model ${modelName} already loaded`);
      return;
    }

    if (this.isInitializing) {
      console.log("⏳ Model initialization in progress, waiting...");
      // Wait for initialization to complete
      while (this.isInitializing) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return;
    }

    this.isInitializing = true;

    try {
      // ✅ Critical fix: Use dynamic import for ESM module
      // This tells Node.js to load the module asynchronously in ESM mode
      const { getLlama, LlamaChatSession } = await import("node-llama-cpp");
      
      const modelPath = getModelPath(modelName);
      console.log(`🧠 Loading LLM from: ${modelPath}`);

      // Get llama instance
      this.llama = await getLlama();
      
      // Load model
      this.model = await this.llama.loadModel({
        modelPath: modelPath,
      });

      // Create context
      this.context = await this.model.createContext();

      // Create chat session
      this.session = new LlamaChatSession({
        contextSequence: this.context.getSequence()
      });

      this.currentModelName = modelName;
      console.log(`✅ LLM ${modelName} loaded successfully`);
    } catch (error: any) {
      console.error("❌ Failed to load LLM:", error);
      // Clean up on error
      this.model = null;
      this.context = null;
      this.session = null;
      this.currentModelName = null;
      throw new Error(`Failed to load model: ${error.message}`);
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Simple chat interface
   * @param userMessage - User's message
   * @returns AI response
   */
  async chat(
    userMessage: string
  ): Promise<string> {
    if (!this.session) {
      await this.initModel();
    }

    if (!this.session) {
      throw new Error("Model not loaded");
    }

    console.log("🧠 Processing message...");

    try {
      // Use session prompt method with message
      const response = await this.session.prompt(userMessage);
      return response;
    } catch (error: any) {
      console.error("❌ Chat failed:", error);
      throw new Error(`Chat failed: ${error.message}`);
    }
  }

  /**
   * Polish subtitles using LLM - Error correction only
   * @param subtitleText - Original subtitle text
   * @returns Corrected Japanese text only (no translation)
   */
  async polishSubtitles(subtitleText: string): Promise<string> {
    // Ultra-minimal prompt: Only fix homophone errors
    const prompt = `Task: Fix Japanese ASR errors.
Input: "${subtitleText}"
Rules:
1. Correct ONLY obvious homophone errors (e.g., "アイズ" -> "合図").
2. If unclear, KEEP ORIGINAL.
3. DO NOT translate.
4. Output ONLY the corrected text. NO explanations.`;

    console.log("🧠 Correcting Japanese ASR errors...");
    const result = await this.chat(prompt);
    
    // Clean possible quotes or prefixes
    return result
      .replace(/^["「]|["」]$/g, '')
      .replace(/^Output:\s*/i, '')
      .replace(/输出[：:]\s*/g, '')
      .trim();
  }

  /**
   * Check if model is loaded
   * @returns True if model is ready
   */
  isModelLoaded(): boolean {
    return this.model !== null && this.session !== null;
  }

  /**
   * Unload model to free memory
   */
  async unloadModel(): Promise<void> {
    if (this.model) {
      console.log("🗑️ Unloading LLM model...");
      // Clean up resources
      this.session = null;
      this.context = null;
      this.model = null;
      this.llama = null;
      this.currentModelName = null;
      console.log("✅ LLM model unloaded");
    }
  }

  /**
   * Get currently loaded model name
   * @returns Model name or null if not loaded
   */
  getCurrentModel(): string | null {
    return this.currentModelName;
  }
}
