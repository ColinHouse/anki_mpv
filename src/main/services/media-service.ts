import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import path from 'path';
import fs from 'fs';
import { getTempDir } from '../utils/file-utils';

// Ensure ffmpeg path is set
if (ffmpegStatic) {
    ffmpeg.setFfmpegPath(ffmpegStatic);
}

export interface MediaAssets {
  audioFilename: string; // e.g. "anki_audio_171000123.mp3"
  audioBase64: string;   // Pure Base64 content
  imageFilename: string; // e.g. "anki_image_171000123.jpg"
  imageBase64: string;   // Pure Base64 content
}

export class MediaService {
  private static instance: MediaService;

  private constructor() {}

  public static getInstance(): MediaService {
    if (!MediaService.instance) {
      MediaService.instance = new MediaService();
    }
    return MediaService.instance;
  }

  private generateFilename(prefix: string, ext: string): string {
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 1000);
      return `${prefix}_${timestamp}_${random}.${ext}`;
  }

  private async fileToBase64(filePath: string): Promise<string> {
      try {
          const buffer = await fs.promises.readFile(filePath);
          // Clean up strictly after reading to avoid filling temp dir
          // Although file-utils might have a global cleanup, getting rid of media assets early is good practice 
          // to keep disk usage low during intensive session.
          await fs.promises.unlink(filePath).catch(() => {}); 
          return buffer.toString('base64');
      } catch (error) {
          console.error(`Failed to read/delete file ${filePath}:`, error);
          throw error;
      }
  }

  /**
   * Extract audio from video segment
   */
  public async extractAudio(videoPath: string, start: number, duration: number): Promise<{filename: string, base64: string}> {
      return new Promise((resolve, reject) => {
          const tempDir = getTempDir();
          if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

          const filename = this.generateFilename('anki_audio', 'mp3');
          const outputPath = path.join(tempDir, filename);

          ffmpeg(videoPath)
              .setStartTime(start)
              .setDuration(duration)
              .audioCodec('libmp3lame') // Convert to mp3 for max compatibility
              .output(outputPath)
              .on('end', async () => {
                  try {
                      const base64 = await this.fileToBase64(outputPath);
                      resolve({ filename, base64 });
                  } catch (e) {
                      reject(e);
                  }
              })
              .on('error', (err) => reject(err))
              .run();
      });
  }

  /**
   * Capture snapshot at specific timestamp
   */
  public async captureSnapshot(videoPath: string, timestamp: number): Promise<{filename: string, base64: string}> {
      return new Promise((resolve, reject) => {
          const tempDir = getTempDir();
          if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

          const filename = this.generateFilename('anki_image', 'jpg');
          
          ffmpeg(videoPath)
              .screenshots({
                  timestamps: [timestamp],
                  filename: filename,
                  folder: tempDir,
                  size: '480x?' // Resize to reasonable width, keep aspect ratio
              })
              .on('end', async () => {
                  try {
                      const outputPath = path.join(tempDir, filename);
                      if (fs.existsSync(outputPath)) {
                          const base64 = await this.fileToBase64(outputPath);
                          resolve({ filename, base64 });
                      } else {
                          reject(new Error("Snapshot file not found"));
                      }
                  } catch (e) {
                      reject(e);
                  }
              })
              .on('error', (err) => reject(err));
      });
  }

  /**
   * Process both audio and image for a subtitle segment
   */
  public async processMedia(videoPath: string, start: number, end: number): Promise<MediaAssets> {
      console.log(`🎬 Processing Media: ${start}s - ${end}s`);
      const duration = end - start;
      const midPoint = start + (duration / 2);

      try {
          const [audio, image] = await Promise.all([
              this.extractAudio(videoPath, start, duration),
              this.captureSnapshot(videoPath, midPoint)
          ]);

          return {
              audioFilename: audio.filename,
              audioBase64: audio.base64,
              imageFilename: image.filename,
              imageBase64: image.base64
          };
      } catch (error) {
          console.error("❌ Media Processing Failed:", error);
          throw error;
      }
  }
}
