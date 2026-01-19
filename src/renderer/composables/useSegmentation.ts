
export interface TokenResult {
  surface: string;
  word: string;
  basicForm: string;
  reading: string;
  pronunciation: string;
  type: string;
  subType: string;
}

export function useSegmentation() {
  const segmentText = async (text: string): Promise<TokenResult[]> => {
    try {
      const result = await (window as any).api.invoke('segment-text', text);
      return result || [];
    } catch (error) {
      console.error("Frontend segmentation error:", error);
      return [];
    }
  };

  return {
    segmentText
  };
}
