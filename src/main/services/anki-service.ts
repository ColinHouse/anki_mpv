import axios from 'axios';

export interface AnkiNoteData {
  word: string;
  reading: string;
  meaning: string;
  sentence: string; // 原句
  audioFilename?: string;
  audioBase64?: string;
  imageFilename?: string;
  imageBase64?: string;
  source?: string;
  aiExplanation?: string;
  sentenceTranslation?: string; // Sentence Translation
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class AnkiService {
  private static instance: AnkiService;
  private readonly ANKI_CONNECT_URL = 'http://127.0.0.1:8765';

  private constructor() {}

  public static getInstance(): AnkiService {
    if (!AnkiService.instance) {
      AnkiService.instance = new AnkiService();
    }
    return AnkiService.instance;
  }

  /**
   * Generic method to invoke AnkiConnect actions
   * doc: https://foosoft.net/projects/anki-connect/
   */
  private async invoke(action: string, params: any = {}): Promise<any> {
    const payload = {
      action,
      version: 6,
      params
    };
    
    const MAX_RETRIES = 3;

    for (let i = 0; i < MAX_RETRIES; i++) {
        try {
          // Hardcoded IPv4 to prevent resolution issues
          const response = await axios.post('http://127.0.0.1:8765', payload, {
              timeout: 10000, // 10s timeout (increased for media)
              headers: { 'Connection': 'close' } // Force short connection
          });
          const data = response.data;

          if (data.error) {
            // AnkiConnect returns "result": null, "error": "..." on failure
            throw new Error(data.error);
          }

          return data.result;
        } catch (error) {
           const isLastAttempt = i === MAX_RETRIES - 1;
           console.warn(`⚠️ Anki req failed (${i + 1}/${MAX_RETRIES}): ${action}`, error instanceof Error ? error.message : error);

           // Re-throw with context or handle connection errors logic checking
           if (axios.isAxiosError(error) && !error.response) {
               // connection error
           }

           if (isLastAttempt) {
               if (axios.isAxiosError(error) && !error.response) {
                   throw new Error("AnkiConnect unreachable. Is Anki running?");
               }
               throw error;
           }
           
           await sleep(500 * (i + 1)); // Backoff: 500ms, 1000ms...
        }
    }
  }

  /**
   * Check if we can talk to Anki
   */
  // Constants
  private readonly DECK_NAME = "Anki-MPV";
  private readonly MODEL_NAME = "Anki-MPV-Model-v2";
  
  // Model Settings
  private readonly MODEL_FIELDS = [
      "Word",       // 单词
      "Reading",    // 读音
      "Meaning",    // 释义
      "Sentence",   // 原句
      "Translation",// 翻译
      "Audio",      // 音频
      "Image",      // 截图
      "Source"      // 来源
  ];

  // iOS Style CSS (v2)
  private readonly MODEL_CSS = `.card { font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; font-size: 16px; text-align: center; color: #333; background-color: #f4f4f9; padding: 20px; } .container { background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); padding: 20px; max-width: 600px; margin: 0 auto; text-align: left; } .word { font-size: 36px; font-weight: bold; color: #2c3e50; text-align: center; margin-bottom: 10px; } .reading { font-size: 18px; color: #7f8c8d; text-align: center; margin-bottom: 20px; } hr { border: 0; height: 1px; background: #e0e0e0; margin: 20px 0; } .meaning { font-size: 16px; line-height: 1.6; color: #34495e; } .sentence { margin-top: 20px; padding: 15px; background: #f8f9fa; border-left: 4px solid #3498db; font-style: italic; color: #555; } img { max-width: 100%; border-radius: 8px; margin-top: 15px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }`;

  private readonly CARD_TEMPLATES = [
      {
          Name: "Card 1",
          Front: `<div class="container"><div class="word">{{Word}}</div><div class="reading">{{Reading}}</div><div style="text-align:center">{{Audio}}</div></div>`,
          Back: `<div class="container"><div class="word">{{Word}}</div><div class="reading">{{Reading}}</div><div style="text-align:center">{{Audio}}</div><hr><div class="meaning">{{Meaning}}</div><div style="text-align:center">{{Image}}</div><div class="sentence">{{Sentence}}</div><div class="sentence">{{Translation}}</div></div>`,
      }
  ];

  public async checkConnection(): Promise<boolean> {
    try {
      const version = await this.invoke('version');
      console.log(`✅ Anki Connected. Version: ${version}`);
      return true;
    } catch (error) {
      console.warn(`⚠️ Anki Connection Failed:`, error instanceof Error ? error.message : error);
      return false;
    }
  }

  /**
   * Main Initialization Flow
   */
  public async initAnki(): Promise<void> {
      try {
          console.log("🏗️ Initializing Anki Infrastructure...");
          // 0. Check connection first
          const connected = await this.checkConnection();
          if (!connected) throw new Error("Anki is not connected");

          // 1. Ensure Deck
          await this.ensureDeck();

          // 2. Ensure Model
          await this.ensureModel();
          
          console.log("✅ Anki Infrastructure Ready");
      } catch (error) {
          console.error("❌ Failed to initialize Anki:", error);
          throw error;
      }
  }

  public async getDeckNames(): Promise<string[]> {
      try {
          return await this.invoke('deckNames');
      } catch (error) {
          console.error("Failed to get deck names:", error);
          return [];
      }
  }

  private async ensureDeck(): Promise<void> {
      const decks = await this.invoke('deckNames');
      if (!decks.includes(this.DECK_NAME)) {
          console.log(`Creating missing deck: ${this.DECK_NAME}`);
          await this.invoke('createDeck', { deck: this.DECK_NAME });
      } else {
          console.log(`✅ Deck confirmed: ${this.DECK_NAME}`);
      }
  }

  private async ensureModel(): Promise<void> {
      // Minimal ensureModel to avoid formatting errors
      const models = await this.invoke('modelNames');
      if (models.includes(this.MODEL_NAME)) {
          console.log(`✅ Model confirmed: ${this.MODEL_NAME}`);
          return;
      }

      console.log(`Creating missing model: ${this.MODEL_NAME}`);

      const createParams = { 
          modelName: this.MODEL_NAME,
          inOrderFields: this.MODEL_FIELDS,
          css: this.MODEL_CSS,
          cardTemplates: this.CARD_TEMPLATES
      };
      console.log("🛠️ Attempting to create model with params:", JSON.stringify(createParams));

      const result = await this.invoke('createModel', createParams);
      console.log("🛠️ Create Model Response:", result);
      
      // AnkiConnect can return null result on success, or error object
      if (result && result.error) {
          throw new Error("Create Model Failed: " + result.error);
      }
      console.log("✅ Model Created Successfully");
  }

  /**
   * Upload media file to Anki
   * @param filename Desired filename (e.g. "sound.mp3")
   * @param data Base64 content
   */
  private async storeMedia(filename: string, data: string): Promise<boolean> {
      try {
          const result = await this.invoke('storeMediaFile', { filename, data });
          // AnkiConnect returns the filename on success, or null/error
          return !!result || result === null; 
      } catch (error) {
          console.error(`❌ Failed to store media ${filename}:`, error);
          return false;
      }
  }

  /**
   * Add a new note to Anki
   */
  public async addNote(data: AnkiNoteData, targetDeck: string): Promise<string | null> {
      try {
          // 1. Upload Media
          if (data.audioFilename && data.audioBase64) {
              await this.storeMedia(data.audioFilename, data.audioBase64);
              await sleep(200); // Breathe
              console.log(`🎤 Audio uploaded: ${data.audioFilename}`);
          }
          if (data.imageFilename && data.imageBase64) {
              await this.storeMedia(data.imageFilename, data.imageBase64);
              await sleep(200); // Breathe
              console.log(`🖼️ Image uploaded: ${data.imageFilename}`);
          }

          // 2. Construct Fields
          const fields: Record<string, string> = {
              "Word": data.word,
              "Reading": data.reading,
              "Meaning": data.meaning,
              "Sentence": data.sentence,
              "Translation": data.sentenceTranslation || "", // Mapped from frontend
              "Audio": "", 
              "Image": "", 
              "Source": data.source || "Anki-MPV"
          };

          // 3. Inject Media References
          if (data.audioFilename) {
              fields["Audio"] = `[sound:${data.audioFilename}]`;
          }
          if (data.imageFilename) {
              fields["Image"] = `<img src="${data.imageFilename}">`;
          }

          // 4. Create Note Payload
          const note = {
              deckName: targetDeck || this.DECK_NAME,
              modelName: this.MODEL_NAME,
              fields: fields,
              options: {
                  allowDuplicate: false,
                  duplicateScope: "deck"
              },
              tags: ["Anki-MPV", "Vocab"]
          };

          // 5. Invoke Add
          const noteId = await this.invoke('addNote', { note });
          if (noteId) {
              console.log(`✅ Note created: ${noteId}`);
              return String(noteId);
          }
          
          return null;

      } catch (error: any) {
          const errMsg = error.message || "";
          // 💡 Self-Healing: If deck/model missing or first attempt fails with "not found"
          if (errMsg.includes('not found') || errMsg.includes('deck') || errMsg.includes('model')) {
              console.warn("⚠️ Anki infrastructure missing. Attempting auto-fix...");
              try {
                  await this.initAnki(); // 👈 Try to fix infrastructure
                  
                  // Retry adding note
                   // Re-Construct Fields
                  const fields: Record<string, string> = {
                      "Word": data.word,
                      "Reading": data.reading,
                      "Meaning": data.meaning,
                      "Sentence": data.sentence,
                      "Translation": data.sentenceTranslation || "", 
                      "Audio": "", 
                      "Image": "", 
                      "Source": data.source || "Anki-MPV"
                  };
                   if (data.audioFilename) fields["Audio"] = `[sound:${data.audioFilename}]`;
                   if (data.imageFilename) fields["Image"] = `<img src="${data.imageFilename}">`;

                  const note = {
                      deckName: targetDeck || this.DECK_NAME,
                      modelName: this.MODEL_NAME,
                      fields: fields,
                      options: { allowDuplicate: false, duplicateScope: "deck" },
                      tags: ["Anki-MPV", "Vocab"]
                  };
                  
                  return await this.invoke('addNote', { note });

              } catch (fixError) {
                  console.error("Auto-fix failed:", fixError);
                  throw error; 
              }
          }
          console.error("❌ Failed to add note:", error);
          throw error;
      }
  }

  // Future methods: addNote, getDeckNames, etc.
}
