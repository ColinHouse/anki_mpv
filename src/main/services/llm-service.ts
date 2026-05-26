import path from "path";
import { app } from "electron";
import fs from "fs";

const LOCAL_LLM_PACKAGE = "node-llama-cpp";

function getStandardModelPath() {
  // 🔒 强制锁定：项目根目录/resources/models/gemma-2-2b-it.Q4_K_M.gguf
  return path.join(process.cwd(), "resources", "models", "gemma-2-2b-it.Q4_K_M.gguf");
}

export class LLMService {
  private static instance: LLMService;
  private session: any = null;
  private context: any = null;
  private model: any = null;
  private isInitializing = false;

  // 🔒 Use standard path
  private modelPath = getStandardModelPath();

  public static getInstance(): LLMService {
    if (!LLMService.instance) LLMService.instance = new LLMService();
    return LLMService.instance;
  }

  private async init() {
    if (this.session || this.isInitializing) return;
    this.isInitializing = true;
    try {
      console.log("🤖 Init LLM from:", this.modelPath);
      
      if (!fs.existsSync(this.modelPath)) {
        console.error(`Model missing at ${this.modelPath}`);
        throw new Error(`Model not found at: ${this.modelPath}`);
      }

      const { getLlama, LlamaChatSession } = await import(LOCAL_LLM_PACKAGE);
      const llama = await getLlama();
      
      console.log("🧠 Loading Local Model:", this.modelPath);
      this.model = await llama.loadModel({ modelPath: this.modelPath });
      this.context = await this.model.createContext();
      this.session = new LlamaChatSession({ contextSequence: this.context.getSequence() });
      
      console.log("✅ Local AI Ready!");
    } catch (e) {
      console.error("❌ Init Failed:", e);
      throw e;
    } finally {
      this.isInitializing = false;
    }
  }

  public async chat(prompt: string, options?: { maxTokens?: number }): Promise<string> {
    if (!this.session) await this.init();
    if (!this.session) throw new Error("AI 模型未加载");

    // Using session.prompt to maintain context, or just one-off
    // Default maxTokens 400 if not provided
    return await this.session.prompt(prompt, { 
      maxTokens: options?.maxTokens ?? 400, 
      temperature: 0.7 
    });
  }

  // ✨ Explain Word (Deep Analysis -> Speed Version)
  public async explainWordInContext(word: string, sentence: string): Promise<string> {
    // ✨ 极速版 Prompt：强制简短，便于 CPU 快速生成
    const prompt = `解释单词 "${word}" 在句子 "${sentence}" 中的用法。
请用中文，仅输出 3 点（不要废话）：
1. **含义**：简短解释。
2. **语感**：(如：口语/正式/贬义)。
3. **语法**：(如有特殊变形)。
保持极度简洁，总字数 100 字以内。`;
    return await this.chat(prompt, { maxTokens: 200 });
  }

  // ✨ Batch Translate
  public async translateBatch(sentences: string[]): Promise<string[]> {
    if (!this.session) await this.init();

    const results: string[] = [];
    // Serial translation to prevent memory overflow
    for (const text of sentences) {
      if (!text || text.trim().length === 0) {
          results.push("");
          continue;
      }
      const prompt = `Translate to Chinese: "${text}". Only output the translation.`;
      try {
        const res = await this.session.prompt(prompt, { maxTokens: 60 }); // Short maxTokens for subs
        results.push(res.replace(/["\n]/g, '').trim());
      } catch (e) {
        console.error(`Batch trans error for ${text}:`, e);
        results.push("[翻译失败]");
      }
    }
    return results;
  }
}
