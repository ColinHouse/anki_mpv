import { ipcMain } from "electron";
import { AnkiService } from "../services/anki-service";

export const registerAnkiHandlers = () => {
  console.log("🟦 Registering Anki handlers...");

  ipcMain.handle("check-anki-connection", async () => {
    try {
      const service = AnkiService.getInstance();
      return await service.checkConnection();
    } catch (error) {
      console.error("❌ Anki connection check failed during IPC:", error);
      return false;
    }
  });

  ipcMain.handle("init-anki", async () => {
    try {
      const service = AnkiService.getInstance();
      await service.initAnki();
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle("get-deck-names", async () => {
      try {
          const service = AnkiService.getInstance();
          const decks = await service.getDeckNames();
          return { success: true, decks };
      } catch (error) {
          return { success: false, error: (error as Error).message };
      }
  });

  ipcMain.handle("add-anki-note", async (_event, data: any) => {
    try {
      // data: { note, deckName } (actually it was passing noteData directly, now let's assume raw data + deckName optional if user passes it?
      // Wait, frontend is calling: invoke('add-anki-note', { ...noteData, deckName: selectedDeck.value })
      // So data contains all AnkiNoteData fields PLUS deckName.
      
      const { deckName, ...noteData } = data; // Extract deckName, rest is noteData

      const service = AnkiService.getInstance();
      const noteId = await service.addNote(noteData, deckName);
      if (noteId) {
          return { success: true, noteId };
      } else {
          return { success: false, error: "Duplicate or failed" };
      }
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });
};
