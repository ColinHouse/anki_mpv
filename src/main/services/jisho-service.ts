import axios from 'axios';

// Jisho API Response Interfaces
interface JishoResponse {
  meta: { status: number };
  data: JishoData[];
}

interface JishoData {
  slug: string;
  is_common?: boolean;
  japanese: { word?: string; reading: string }[];
  senses: {
    english_definitions: string[];
    parts_of_speech: string[];
  }[];
  jlpt: string[];
}

// Frontend Compatible Interface
export interface DictionaryResult {
  id: string;
  word: string;
  reading: string;
  pronunciation: string;
  definitions: string[];
  examples: { japanese: string; translation: string }[];
  type: string;
}

export class JishoService {
  private static instance: JishoService;
  private readonly API_URL = "https://jisho.org/api/v1/search/words";

  // Browser Headers to bypass 403
  private readonly headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5"
  };

  private constructor() {}

  public static getInstance(): JishoService {
    if (!JishoService.instance) {
      JishoService.instance = new JishoService();
    }
    return JishoService.instance;
  }

  public async lookup(text: string): Promise<DictionaryResult | null> {
    try {
      if (!text) return null;
      
      // 🐛 Debug: Print Hex to verify UTF-8 integrity in memory (ignores console display issues)
      const hex = Buffer.from(text).subarray(0, 10).toString('hex');
      console.log(`🔍 Jisho Lookup: ${text} (Hex: ${hex})`);

      const url = `${this.API_URL}?keyword=${encodeURIComponent(text)}`;
      console.log(`🌐 Requesting: ${url}`);

      const response = await axios.get<JishoResponse>(url, {
        headers: this.headers
      });

      if (response.status !== 200 || !response.data.data || response.data.data.length === 0) {
        return null;
      }

      const entry = response.data.data[0];

      const japItem = entry.japanese[0];
      const word = japItem.word || japItem.reading;
      const reading = japItem.reading;

      let definitions: string[] = [];
      let type = "";

      if (entry.senses.length > 0) {
        const firstSense = entry.senses[0];
        definitions = firstSense.english_definitions;
        if (firstSense.parts_of_speech.length > 0) {
          type = firstSense.parts_of_speech[0];
        }
      }

      if (entry.jlpt && entry.jlpt.length > 0) {
        const jlpt = entry.jlpt.map(s => s.replace('jlpt-', 'N').toUpperCase()).join(', ');
        if (type) {
            type = `${type} (${jlpt})`;
        } else {
            type = jlpt;
        }
      }

      return {
        id: entry.slug,
        word: word,
        reading: reading,
        pronunciation: reading,
        definitions: definitions,
        examples: [],
        type: type
      };

    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
         console.error(`❌ Jisho API Error [${text}]: Status ${error.response.status}`, error.response.data);
      } else {
         console.error(`❌ Jisho API Error [${text}]:`, error instanceof Error ? error.message : String(error));
      }
      return null;
    }
  }
}
