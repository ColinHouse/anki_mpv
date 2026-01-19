/**
 * WhisperCommand: Pure function module for building Whisper CLI arguments.
 * 
 * Responsibility: Convert WhisperTaskContext into command-line arguments array.
 * NO side effects, NO external dependencies.
 */

import { WhisperTaskContext } from './types';

/**
 * Build Whisper command-line arguments from task context.
 * 
 * Key fixes from original code:
 * - Removed unsupported `--output-dir` parameter
 * - Uses `-osrt` for SRT output format
 * - Standardized thread count to 4
 * 
 * @param context - Task context containing all necessary parameters
 * @returns Array of command-line arguments for Whisper executable
 * 
 * @example
 * ```typescript
 * const args = buildWhisperArgs({
 *   id: 'task-123',
 *   videoPath: '/path/to/video.mp4',
 *   audioPath: '/path/to/audio.wav',
 *   modelPath: '/path/to/model.bin',
 *   language: 'ja'
 * });
 * // Returns: ['-m', '/path/to/model.bin', '-f', '/path/to/audio.wav', '-l', 'ja', '-osrt', '-t', '4']
 * ```
 */
export function buildWhisperArgs(context: WhisperTaskContext): string[] {
  return [
    '-m',              // Model flag
    context.modelPath, // Model path
    '-f',              // File flag
    context.audioPath, // Audio file path
    '-l',              // Language flag
    context.language,  // Language code (e.g., 'ja', 'en')
    '-osrt',           // Output format: SRT
    '-t',              // Thread count flag
    '4',               // 4 threads for optimal performance
  ];
}

/**
 * Get the expected SRT output paths based on audio path.
 * Whisper's behavior varies by version - it may generate either:
 * - {audioPath}.srt (append mode)
 * - {audioPath.replace('.wav', '.srt')} (replace mode)
 * 
 * @param audioPath - Path to the audio file
 * @returns Object with both possible SRT paths
 */
export function getExpectedSrtPaths(audioPath: string): {
  /** Default path: audio.wav.srt */
  defaultPath: string;
  /** Target path: audio.srt */
  targetPath: string;
} {
  return {
    // Whisper default behavior: append .srt to original filename
    defaultPath: audioPath + '.srt',
    
    // Desired target: replace .wav extension with .srt
    targetPath: audioPath.replace(/\.wav$/, '.srt'),
  };
}
