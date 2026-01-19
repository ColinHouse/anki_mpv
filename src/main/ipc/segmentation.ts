import { ipcMain } from "electron";
import { SegmentationService } from "../services/segmentation-service";

export const registerSegmentationHandlers = () => {
  console.log("✂️ Registering Segmentation handlers...");

  ipcMain.handle("segment-text", async (_event, text: string) => {
    try {
      // Input validation
      if (!text || typeof text !== 'string') {
        console.warn("⚠️ Invalid text for segmentation:", text);
        return [];
      }

      const service = SegmentationService.getInstance();
      const results = service.tokenize(text);
      return results;

    } catch (error) {
      console.error("❌ Segmentation failed:", error);
      return [];
    }
  });
};
