/**
 * WhisperExecutor: Manages Whisper child process lifecycle.
 * 
 * Responsibility: Spawn Whisper process and manage its lifecycle.
 * CRITICAL: All progress events MUST include task ID from context.
 */

import { spawn, ChildProcess } from 'child_process';
import fs from 'node:fs';
import path from 'node:path';
import { BrowserWindow } from 'electron';
import { WhisperTaskContext, WhisperProgress, WhisperResult } from './types';
import { buildWhisperArgs, getExpectedSrtPaths } from './WhisperCommand';
import { parseTimestamp, calculateProgress } from './WhisperParser';

/**
 * Executor for managing Whisper recognition process.
 * Ensures task ID is properly propagated through all events.
 */
export class WhisperExecutor {
  private whisperProcess: ChildProcess | null = null;

  constructor(private mainWindow: BrowserWindow) {}

  /**
   * Execute Whisper recognition for the given task context.
   * 
   * CRITICAL REQUIREMENTS:
   * 1. All sendProgress calls MUST include context.id
   * 2. No external mutable variables in callbacks
   * 3. Handle both .wav.srt and .srt file extensions
   * 
   * @param context - Task context with all necessary information
   * @param whisperPath - Absolute path to Whisper executable
   * @param audioDuration - Audio duration in seconds (for progress calculation)
   * @returns Promise resolving to recognition result
   */
  async execute(
    context: WhisperTaskContext,
    whisperPath: string,
    audioDuration: number
  ): Promise<WhisperResult> {
    const args = buildWhisperArgs(context);
    const workDir = path.dirname(whisperPath);

    console.log('🚀 Starting Whisper with args:', args);
    console.log('📁 Audio path:', context.audioPath);
    console.log('🤖 Model path:', context.modelPath);
    console.log('🆔 Task ID:', context.id);

    // Spawn Whisper process
    this.whisperProcess = spawn(whisperPath, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: workDir,
    });

    return new Promise((resolve) => {
      let lastProgress = 0;

      // Monitor spawn errors
      this.whisperProcess!.on('error', (err) => {
        console.error('❌ Spawn Error:', err);
        this.sendProgress(context.id, {
          id: context.id,
          status: 'error',
          progress: 0,
          error: err.message,
        });
        resolve({ success: false, error: err.message });
      });

      // Parse stdout for progress updates
      this.whisperProcess!.stdout?.on('data', (data) => {
        const output = data.toString();
        console.log('📢 Whisper stdout:', output);

        const lines = output.split('\n');
        for (const line of lines) {
          if (!line.trim()) continue;

          const timestampSeconds = parseTimestamp(line);
          if (timestampSeconds !== null && audioDuration > 0) {
            const progress = calculateProgress(timestampSeconds, audioDuration);

            // Throttle updates: only send if progress changed by >1%
            if (Math.abs(progress - lastProgress) > 0.01) {
              lastProgress = progress;
              this.sendProgress(context.id, {
                id: context.id,
                status: 'processing',
                progress,
                currentText: line,
              });
            }
          }
        }
      });

      // Log stderr (Whisper may output diagnostics here)
      this.whisperProcess!.stderr?.on('data', (data) => {
        const errorOutput = data.toString();
        console.log('📢 Whisper stderr:', errorOutput);
      });

      // Handle process completion
      this.whisperProcess!.on('close', (code) => {
        console.log('🏁 Whisper process exited with code:', code);

        if (code === 0) {
          this.handleSuccessfulCompletion(context, audioDuration, resolve);
        } else {
          const errorMsg = `Whisper process failed with code ${code}`;
          console.error('❌', errorMsg);
          this.sendProgress(context.id, {
            id: context.id,
            status: 'error',
            progress: 1.0,
            error: errorMsg,
          });
          resolve({ success: false, error: errorMsg });
        }
      });
    });
  }

  /**
   * Handle successful Whisper completion.
   * Checks for SRT file in multiple possible locations (fixes extension bug).
   */
  private handleSuccessfulCompletion(
    context: WhisperTaskContext,
    audioDuration: number,
    resolve: (value: WhisperResult) => void
  ): void {
    const { defaultPath, targetPath } = getExpectedSrtPaths(context.audioPath);

    // Delay 1s to ensure Whisper releases file handle
    setTimeout(() => {
      try {
        let srtContent: string;
        let finalPath: string;

        // Check for SRT file in both possible locations
        if (fs.existsSync(defaultPath)) {
          // Case 1: audio.wav.srt (Whisper append mode)
          const rawBuffer = fs.readFileSync(defaultPath);
          
          // Add BOM header for Windows encoding compatibility
          const bomBuffer = Buffer.from([0xef, 0xbb, 0xbf]);
          const finalBuffer = Buffer.concat([bomBuffer, rawBuffer]);
          
          // Write to target path (audio.srt)
          fs.writeFileSync(targetPath, finalBuffer);
          console.log('✅ SRT processed and saved to:', targetPath);
          
          // Delete original if different
          if (defaultPath !== targetPath) {
            fs.unlinkSync(defaultPath);
          }
          
          srtContent = finalBuffer.toString('utf8');
          finalPath = targetPath;
        } else if (fs.existsSync(targetPath)) {
          // Case 2: audio.srt (Whisper replace mode or already processed)
          srtContent = fs.readFileSync(targetPath, 'utf-8');
          finalPath = targetPath;
        } else {
          throw new Error(
            `Generated SRT file not found at: ${defaultPath} or ${targetPath}`
          );
        }

        // ✅ CRITICAL: Send completion status WITH srtContent
        // Frontend expects progress.srtContent (see App.vue:1560)
        this.sendProgress(context.id, {
          id: context.id,
          status: 'completed',
          progress: 1.0,
          currentText: srtContent, // ✅ Add srtContent for frontend compatibility
        });

        // Clean up temporary audio file
        this.cleanupAudioFile(context.audioPath);

        resolve({
          success: true,
          data: {
            srtContent,
            srtPath: finalPath,
            duration: audioDuration,
          },
        });
      } catch (error) {
        console.error('❌ Process SRT error:', error);
        this.sendProgress(context.id, {
          id: context.id,
          status: 'error',
          progress: 1,
          error: 'Failed to process result file',
        });
        resolve({ success: false, error: (error as Error).message });
      }
    }, 1000);
  }

  /**
   * Clean up temporary audio file.
   */
  private cleanupAudioFile(audioPath: string): void {
    try {
      if (fs.existsSync(audioPath)) {
        fs.unlinkSync(audioPath);
        console.log('🗑️ Cleaned up temporary audio file:', audioPath);
      }
    } catch (cleanupError) {
      console.warn('⚠️ Failed to clean up audio file:', cleanupError);
    }
  }

  /**
   * Send progress update to frontend.
   * CRITICAL: Always includes task ID.
   * 
   * @param taskId - Task ID to include in the event
   * @param progress - Progress data
   */
  private sendProgress(taskId: string, progress: WhisperProgress): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      // Ensure progress object always has the ID
      const progressWithId = { ...progress, id: taskId };
      this.mainWindow.webContents.send('whisper-status', progressWithId);
      console.log('📊 Progress update:', progressWithId);
    }
  }

  /**
   * Stop the running Whisper process.
   */
  stop(taskId: string): void {
    if (this.whisperProcess) {
      console.log('🛑 Stopping Whisper process...');
      this.whisperProcess.kill('SIGTERM');
      this.whisperProcess = null;
      this.sendProgress(taskId, {
        id: taskId,
        status: 'error',
        progress: 0,
        error: 'Process stopped by user',
      });
    }
  }
}
