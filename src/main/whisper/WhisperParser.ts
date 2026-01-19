/**
 * WhisperParser: Pure function module for parsing Whisper output.
 * 
 * Responsibility: Parse stdout/stderr from Whisper process to extract useful information.
 * NO side effects, NO state management.
 */

/**
 * Parse timestamp from Whisper output line.
 * 
 * Whisper outputs timestamps in format: [HH:MM:SS.mmm --> HH:MM:SS.mmm]
 * We extract the END timestamp to calculate progress.
 * 
 * @param line - Single line of Whisper stdout
 * @returns End timestamp in seconds, or null if no timestamp found
 * 
 * @example
 * ```typescript
 * parseTimestamp('[00:00:00.000 --> 00:00:05.360]');
 * // Returns: 5.36
 * 
 * parseTimestamp('Some other output');
 * // Returns: null
 * ```
 */
export function parseTimestamp(line: string): number | null {
  // Match timestamp format: [HH:MM:SS.mmm --> HH:MM:SS.mmm]
  const timestampRegex = /\[(\d{2}:\d{2}:\d{2}\.\d{3}) --> (\d{2}:\d{2}:\d{2}\.\d{3})\]/;
  const match = line.match(timestampRegex);

  if (!match) {
    return null;
  }

  // Extract end timestamp (second capture group)
  const endTimeStr = match[2];
  const timeParts = endTimeStr.split(':');
  
  const hours = parseInt(timeParts[0], 10);
  const minutes = parseInt(timeParts[1], 10);
  const seconds = parseFloat(timeParts[2]);

  // Convert to total seconds
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Calculate progress percentage from timestamp and total duration.
 * 
 * @param timestampSeconds - Current timestamp in seconds (from parseTimestamp)
 * @param totalDuration - Total audio duration in seconds
 * @returns Progress as decimal (0.0 to 1.0), clamped to max 1.0
 * 
 * @example
 * ```typescript
 * calculateProgress(30, 100);
 * // Returns: 0.3 (30%)
 * 
 * calculateProgress(120, 100);
 * // Returns: 1.0 (clamped, 100%)
 * ```
 */
export function calculateProgress(
  timestampSeconds: number,
  totalDuration: number
): number {
  if (totalDuration <= 0) {
    return 0;
  }
  
  // Ensure progress doesn't exceed 100%
  return Math.min(timestampSeconds / totalDuration, 1.0);
}

/**
 * Parse SRT time string to seconds.
 * Format: HH:MM:SS,mmm (note: comma separator for milliseconds in SRT)
 * 
 * @param timeStr - SRT time string
 * @returns Time in seconds (including fractional milliseconds)
 * 
 * @example
 * ```typescript
 * parseSRTTime('00:01:30,500');
 * // Returns: 90.5
 * ```
 */
export function parseSRTTime(timeStr: string): number {
  const [timePart, msPart] = timeStr.split(',');
  const [hours, minutes, seconds] = timePart.split(':').map(Number);
  const milliseconds = Number(msPart) / 1000;

  return hours * 3600 + minutes * 60 + seconds + milliseconds;
}

/**
 * Format seconds to SRT time format.
 * Format: HH:MM:SS,mmm
 * 
 * @param seconds - Time in seconds (can include fractional part)
 * @returns SRT formatted time string
 * 
 * @example
 * ```typescript
 * formatSRTTime(90.5);
 * // Returns: '00:01:30,500'
 * ```
 */
export function formatSRTTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
}
