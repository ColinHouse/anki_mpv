import { ipcMain } from "electron";
import { JishoService } from "../services/jisho-service";

export const registerDictionaryHandlers = () => {
  console.log("📖 Registering Dictionary handlers...");

  ipcMain.handle("lookup-word", async (_event, text: string) => {
    try {
      if (!text || typeof text !== 'string') {
          console.warn("⚠️ Invalid text for dictionary lookup:", text);
          return null;
      }
      console.log(`🔍 Dictionary Lookup requested: ${text}`);
      
      const service = JishoService.getInstance();
      const result = await service.lookup(text);
      return result;
    } catch (error) {
      console.error("❌ Dictionary lookup failed:", error);
      return null;
    }
  });
};
