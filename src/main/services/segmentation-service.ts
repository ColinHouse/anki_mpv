import kuromoji from "kuromoji";
import path from "node:path";
import { app } from "electron";
import fs from "node:fs";

export interface TokenResult {
  surface: string;     // [NEW] 原始文本 (UI显示用)
  word: string;        // Compatibility (Search/Legacy)
  basicForm: string;   // 查词用的原形 (如 "すまない" 或 "済む")
  reading: string;     // 读音
  pronunciation: string; // 发音
  type: string;        // 词性
  subType: string;     // 词性细分
}

export class SegmentationService {
  private static instance: SegmentationService;
  private tokenizer: kuromoji.Tokenizer<kuromoji.IpadicFeatures> | null = null;
  private initializing: Promise<void> | null = null;

  private constructor() {}

  public static getInstance(): SegmentationService {
    if (!SegmentationService.instance) {
      SegmentationService.instance = new SegmentationService();
    }
    return SegmentationService.instance;
  }

  /**
   * 获取字典路径
   */
  private getDicPath(): string {
    let dicPath = path.join(process.cwd(), 'node_modules', 'kuromoji', 'dict');
    if (!fs.existsSync(dicPath) && app.isPackaged) {
         dicPath = path.join(process.resourcesPath, 'dict');
    }
    console.log("📚 Kuromoji Dict Path:", dicPath);
    return dicPath;
  }

  /**
   * 初始化分词器
   */
  public async init(): Promise<void> {
    if (this.tokenizer) return;
    if (this.initializing) return this.initializing;

    this.initializing = new Promise((resolve, reject) => {
      const dicPath = this.getDicPath();
      
      kuromoji.builder({ dicPath }).build((err, tokenizer) => {
        if (err) {
          console.error("❌ Failed to build kuromoji tokenizer:", err);
          reject(err);
        } else {
          this.tokenizer = tokenizer;
          console.log("✅ Kuromoji tokenizer initialized");
          resolve();
        }
      });
    });

    try {
      await this.initializing;
    } finally {
      this.initializing = null;
    }
  }

  /**
   * 原始分词方法
   */
  private rawTokenize(text: string): kuromoji.IpadicFeatures[] {
    if (!this.tokenizer) {
      throw new Error("Tokenizer not initialized");
    }
    return this.tokenizer.tokenize(text);
  }

  /**
   * 辅助函数：手动创建 Token
   */
  private createManualToken(surface: string, pos: string, basic: string, reading: string): any {
    return {
      surface_form: surface,
      pos: pos,
      basic_form: basic,
      reading: reading,
      pronunciation: reading,
      pos_detail_1: '一般', // 默认值
      pos_detail_2: '*',
      pos_detail_3: '*',
      conjugated_type: '*',
      conjugated_form: '*',
    };
  }

  /**
   * 步骤 3: 补丁修复 (Patching)
   * 解决分词器原生错误，如 "するどう"
   */
  private patchTokens(tokens: kuromoji.IpadicFeatures[]): kuromoji.IpadicFeatures[] {
    const patched: kuromoji.IpadicFeatures[] = [];
    
    for (const token of tokens) {
      // Rule A: 修复 "するどう" (形容词) -> "する" (动词) + "どう" (副词)
      if (token.surface_form === 'するどう' && token.pos === '形容詞') {
        patched.push(this.createManualToken('する', '動詞', 'する', 'スル'));
        patched.push(this.createManualToken('どう', '副詞', 'どう', 'ドウ'));
        continue; // 跳过原 token
      }
      
      // Rule B: 通用拆分可在此添加

      patched.push(token);
    }
    
    return patched;
  }

  /**
   * 步骤 4-6: 标准化与合并 (Normalization)
   * 处理：口语、活用、后缀、数词合并
   */
  private normalizeTokens(tokens: kuromoji.IpadicFeatures[]): TokenResult[] {
    const results: TokenResult[] = [];
    if (tokens.length === 0) return results;

    let i = 0;
    while (i < tokens.length) {
      let curr = tokens[i]; // 使用 let 因为我们可能要修改它 (如 slang fix)
      const next = i + 1 < tokens.length ? tokens[i + 1] : null;
      let processedToken: TokenResult | null = null;
      let consumedNext = false;

      // 4. 口语还原 (Slang Fix) - 单个词处理
      if (curr.surface_form === 'ちゃう') {
         // curr = { ...curr, basic_form: 'てしまう' }; // Do not mutate surface_form if we want to retrieve it later? 
         // Actually curr is IpadicFeatures.
         // We want basic_form to be 'てしまう', display 'ちゃう'
         curr = { ...curr, basic_form: 'てしまう' };
      } else if (curr.surface_form === 'なきゃ') {
         curr = { ...curr, basic_form: 'なければならない' };
      } else if (curr.surface_form === 'なくちゃ') {
         curr = { ...curr, basic_form: 'なくてはならない' };
      }

      // 1. 数词合并 (Number Fix)
      const isNum = curr.pos === '名詞' && curr.pos_detail_1 === '数';
      const isNextCounter = next && next.pos === '名詞' && next.pos_detail_1 === '接尾';
      const isNextNum = next && next.pos === '名詞' && next.pos_detail_1 === '数';

      if (isNum && (isNextCounter || isNextNum)) {
        const mergedSurface = curr.surface_form + next!.surface_form;
        const mergedWord = mergedSurface; // Word defaults to surface for numbers? Or Basic? Let's use surface.
        let mergedReading = (curr.reading || '') + (next!.reading || '');
        const mergedPron = (curr.pronunciation || '') + (next!.pronunciation || '');
        
        if (mergedWord === '一人') mergedReading = 'ヒトリ';
        if (mergedWord === '二人') mergedReading = 'フタリ';

        processedToken = {
          surface: mergedSurface,
          word: mergedWord,
          basicForm: mergedWord,
          reading: mergedReading,
          pronunciation: mergedPron,
          type: curr.pos,
          subType: '数詞'
        };
        consumedNext = true;
      }

      // 5. 活用还原 & 6. 后缀丢弃 (Conjugation & Suffix Drop)
      // 如果还没处理，检查动词/形容词后缀
      else if (!processedToken && (curr.pos === '動詞' || curr.pos === '形容詞') && next) {
          const nextBasic = next.basic_form;

          // Rule 5: 活用还原 (Verb + Ba/You -> Verb Basic)
          if (next.pos === '助詞' && next.surface_form === 'ば') {
             // すれ + ば -> すれば (Display), する (Basic)
             processedToken = {
                 surface: curr.surface_form + next.surface_form,
                 word: (curr.basic_form && curr.basic_form !== '*') ? curr.basic_form : curr.surface_form, // Word = Basic per logic
                 basicForm: (curr.basic_form && curr.basic_form !== '*') ? curr.basic_form : curr.surface_form,
                 reading: (curr.reading || '') + (next.reading || ''),
                 pronunciation: (curr.pronunciation || '') + (next.pronunciation || ''),
                 type: curr.pos,
                 subType: '活用'
             };
             consumedNext = true;
          }
          else if (next.pos === '助動詞' && (next.surface_form === 'う' || next.surface_form === 'よう')) {
             // し + よう -> しよう (Display), する (Basic)
             processedToken = {
                 surface: curr.surface_form + next.surface_form,
                 word: (curr.basic_form && curr.basic_form !== '*') ? curr.basic_form : curr.surface_form,
                 basicForm: (curr.basic_form && curr.basic_form !== '*') ? curr.basic_form : curr.surface_form,
                 reading: (curr.reading || '') + (next.reading || ''),
                 pronunciation: (curr.pronunciation || '') + (next.pronunciation || ''),
                 type: curr.pos,
                 subType: '意志'
             };
             consumedNext = true;             
          }
          
          // Rule 6: 后缀丢弃 (Suffix Drop v2) - Ta/Te/De/Da/Masu
          else if (next.pos === '助動詞' || next.pos === '助詞') {
              // 助词中 て/で 是 助词-接続助詞
              const targetSuffixes = ['た', 'て', 'で', 'だ', 'ます'];
              if (targetSuffixes.includes(nextBasic) || targetSuffixes.includes(next.surface_form)) {
                 // 保留动词原形，丢弃后缀
                 const basic = (curr.basic_form && curr.basic_form !== '*') ? curr.basic_form : curr.surface_form;
                 processedToken = {
                     surface: curr.surface_form + next.surface_form, // Display whole thing!
                     word: basic, 
                     basicForm: basic,
                     reading: curr.reading || curr.surface_form, // 读音保留动词部分？Or merged? Original logic kept curr.
                     pronunciation: curr.pronunciation || curr.reading || curr.surface_form,
                     type: curr.pos,
                     subType: curr.pos_detail_1
                 };
                 consumedNext = true;
              }
          }
      }

      // 2. 否定形合并 (Negative Merge)
      if (!processedToken && (curr.pos === '動詞' || curr.pos === '形容詞') && next && next.pos === '助動詞') {
         const nextBasic = next.basic_form;
         if (nextBasic === 'ない' || nextBasic === 'ぬ' || nextBasic === 'ん') {
            const mergedSurface = curr.surface_form + next.surface_form;
            processedToken = {
                surface: mergedSurface,
                word: mergedSurface, // Negative usually keeps negative form? Or Basic? Logic says `curr.basic_form` (Wait, line 235 used curr.basic_form?)
                // Line 235 in original: basicForm: ... curr.basic_form. Meaning "Tabenai" -> "Taberu"?
                // If so, card shows "Taberu". Text shows "Tabenai".
                // I will keep logic: Basic = curr.basic_form. Surface = merged.
                basicForm: (curr.basic_form && curr.basic_form !== '*') ? curr.basic_form : curr.surface_form, 
                reading: (curr.reading || '') + (next.reading || ''),
                pronunciation: (curr.pronunciation || '') + (next.pronunciation || ''),
                type: curr.pos,
                subType: '否定'
            };
            consumedNext = true;
         }
      }

      // 4. 形式名词合并 (You + Da)
      if (!processedToken && curr.surface_form === 'よう' && next && next.basic_form === 'だ') {
          processedToken = {
              surface: curr.surface_form + next.surface_form, // "Youda"
              word: curr.surface_form, // "You"
              basicForm: 'よう', // 保留 よう
              reading: curr.reading || '',
              pronunciation: curr.pronunciation || '',
              type: curr.pos,
              subType: curr.pos_detail_1
          };
          consumedNext = true;
      }

      // Default Handler
      if (!processedToken) {
          const basic = (curr.basic_form && curr.basic_form !== '*') ? curr.basic_form : curr.surface_form;
          processedToken = {
              surface: curr.surface_form,
              word: curr.surface_form, // Default: Word = Surface
              basicForm: basic,
              reading: curr.reading || curr.surface_form,
              pronunciation: curr.pronunciation || curr.reading || curr.surface_form,
              type: curr.pos,
              subType: curr.pos_detail_1
          };
      }

      results.push(processedToken);
      i += consumedNext ? 2 : 1;
    }
    
    return results;
  }

  /**
   * 步骤 7: 过滤 (Filter)
   * 白名单机制
   */
  private filterTokens(tokens: TokenResult[]): TokenResult[] {
      // 白名单
      const whitelist = ['名詞', '動詞', '形容詞', '副詞', '連体詞'];
      
      return tokens.filter(t => {
          if (!whitelist.includes(t.type)) return false;
          
          // 额外黑名单 (即使在白名单内)
          if (t.type === '名詞') {
              // 保留代名词 (如 私), 但排除 非自立?
              // 用户说 "保留代名詞", "排除 非自立"? 视需求。
              // 暂时简单点，只排除明确的垃圾
              if (t.subType === '非自立' && t.basicForm !== 'よう') return false; // "の" 或者是 "こと" 有时是非自立
          }
          
          return true;
      });
  }

  /**
   * 公开分词方法：Pipeline 调用
   */
  public tokenize(text: string): TokenResult[] {
    if (!text || text.trim() === '') return [];

    try {
      const raw = this.rawTokenize(text);
      const patched = this.patchTokens(raw);
      const normalized = this.normalizeTokens(patched);
      console.log(`🔍 Pipeline Result "${text}":`, normalized.map(r => `${r.word}(${r.basicForm})`));
      return normalized;
    } catch (error) {
      console.error(`❌ Tokenization CRITICAL FAILURE for text: "${text}"`, error);
      // Fallback: Return original text as a single token
      return [{
          surface: text,
          word: text,
          basicForm: text,
          reading: text,
          pronunciation: text,
          type: '未知', // Mark as Unknown so it renders but maybe without dictionary lookup
          subType: 'Fallback'
      }];
    }
  }

  /**
   * 带过滤的分词：用于提取单词
   */
  public tokenizeFiltered(text: string): TokenResult[] {
    const tokens = this.tokenize(text);
    return this.filterTokens(tokens);
  }
}
