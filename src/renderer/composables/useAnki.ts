import { ref } from 'vue';
import type { SubtitleContext, AnkiNoteData, DictionaryResult } from '../types';

export function useAnki() {
  const isAdding = ref(false);
  const addSuccess = ref(false);
  const error = ref<string | null>(null);

  // Deck State
  const deckList = ref<string[]>([]);
  const selectedDeck = ref<string>("Default");

  /**
   * Fetch available decks from Anki
   */
  const fetchDecks = async () => {
      try {
          const res = await (window as any).api.invoke('get-deck-names');
          if (res.success && Array.isArray(res.decks)) {
              deckList.value = res.decks;
              // Set default if not set or not in list
              if (selectedDeck.value === "Default" || !deckList.value.includes(selectedDeck.value)) {
                   if (deckList.value.includes("Anki-MPV")) {
                       selectedDeck.value = "Anki-MPV";
                   } else if (deckList.value.length > 0) {
                       selectedDeck.value = deckList.value[0];
                   }
              }
          }
      } catch (e) {
          console.error("Failed to fetch decks:", e);
      }
  };

  /**
   * Helper to generate media assets from backend
   */
  const generateMedia = async (context: SubtitleContext) => {
    try {
      // Invoke Stage 3: Process Media
      const assets = await (window as any).api.invoke('process-media', {
        videoPath: context.videoPath,
        start: context.startTime,
        end: context.endTime
      });
      
      if (assets.error) throw new Error(assets.error);
      return assets;
    } catch (err) {
      console.error("Media generation failed:", err);
      throw err;
    }
  };

  /**
   * Main Action: Add Word + Context to Anki
   */
  const addToAnki = async (wordData: DictionaryResult, context: SubtitleContext, aiExplanation?: string) => {
    if (isAdding.value) return;

    isAdding.value = true;
    error.value = null;
    addSuccess.value = false;

    try {
      // 1. Generate Media (Audio & Image)
      const mediaAssets = await generateMedia(context);

      // 2. Construct Meaning (Dictionary + AI)
      let finalMeaning = wordData.definitions?.join('<br>') || '';
      if (aiExplanation) {
          finalMeaning += `<br><br><div style="text-align:left; background-color:#f0f7ff; padding:10px; border-radius:5px; font-size: 0.9em;"><b>🤖 AI 深度解析:</b><br>${aiExplanation}</div>`;
      }

      // 3. Construct Note Data
      const noteData: AnkiNoteData = {
        word: wordData.word || wordData.id,
        reading: wordData.reading || '',
        meaning: finalMeaning,
        sentence: context.sentenceText,
        audioFilename: mediaAssets.audioFilename,
        audioBase64: mediaAssets.audioBase64,
        imageFilename: mediaAssets.imageFilename,
        imageBase64: mediaAssets.imageBase64,
        source: "Anki-MPV",
        aiExplanation: aiExplanation, // Pass it just in case backend uses it later
        sentenceTranslation: context.sentenceTranslation || context.translation // Use passed trans or context trans
      };

      // 4. Send to Backend (Stage 4) with Deck Name
      // We mix the noteData with deckName for the IPC handler
      let result = await (window as any).api.invoke('add-anki-note', {
          ...noteData, 
          deckName: selectedDeck.value
      });

      // Auto-retry: If model missing, try to init and send again
      if (!result.success && (result.error?.includes("model") || result.error?.includes("deck"))) {
          console.warn("Anki model/deck missing, attempting to re-init...");
          await (window as any).api.invoke('init-anki');
          
          // Retry fetch decks too just in case
          await fetchDecks();

          result = await (window as any).api.invoke('add-anki-note', {
             ...noteData,
             deckName: selectedDeck.value
          });
      }

      if (result.success) {
        addSuccess.value = true;
        console.log(`✅ Added card: ${result.noteId}`);
        // Reset success state
        setTimeout(() => {
          addSuccess.value = false;
        }, 3000);
      } else {
        throw new Error(result.error || "Unknown error during add-note");
      }

    } catch (err) {
      console.error("Failed to add to Anki:", err);
      // Friendly error message
      if ((err as Error).message.includes("Failed to fetch")) {
          error.value = "无法连接 Anki，请确保 Anki 已打开并安装插件。";
      } else {
          error.value = (err as Error).message;
      }
    } finally {
      isAdding.value = false;
    }
  };

  return {
    isAdding,
    addSuccess,
    error,
    deckList,
    selectedDeck,
    fetchDecks,
    addToAnki
  };
}
