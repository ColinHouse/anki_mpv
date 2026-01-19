import { ipcMain } from "electron";
import { MediaService } from "../services/media-service";

export const registerMediaHandlers = () => {
  console.log("🎞️ Registering Media handlers...");

  ipcMain.handle("process-media", async (_event, params: { videoPath: string; start: number; end: number }) => {
    try {
      const { videoPath, start, end } = params;
      if (!videoPath || start === undefined || end === undefined) {
          throw new Error("Missing required parameters for media processing");
      }
      
      const service = MediaService.getInstance();
      return await service.processMedia(videoPath, start, end);
    } catch (error) {
      console.error("❌ Media IPC Error:", error);
      return { error: (error as Error).message };
    }
  });
};
