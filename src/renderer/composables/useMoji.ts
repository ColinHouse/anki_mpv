export interface DictionaryResult {
  id: string;
  word: string;
  reading: string;
  pronunciation: string;
  definitions: string[];
  examples: {
    japanese: string;
    translation: string;
  }[];
  type?: string;
}

export function useMoji() {
  const lookupWord = async (text: string): Promise<DictionaryResult | null> => {
    try {
      if (!text) return null;
      console.log("🔍 Calling Moji IPC for:", text);
      const result = await (window as any).api.invoke('lookup-word', text);
      return result;
    } catch (error) {
      console.error("Frontend Moji lookup error:", error);
      return null;
    }
  };

  return {
    lookupWord
  };
}
