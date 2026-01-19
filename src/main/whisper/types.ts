/**
 * Core type definitions for Whisper task management.
 * Ensures task context and ID propagation throughout the recognition pipeline.
 */

/**
 * Task context that flows through all Whisper modules.
 * Contains all necessary information for a single recognition task.
 */
export interface WhisperTaskContext {
  /** Unique task identifier (UUID from frontend) */
  id: string;
  
  /** Original video file path */
  videoPath: string;
  
  /** Extracted temporary audio file path */
  audioPath: string;
  
  /** Absolute path to the Whisper model file */
  modelPath: string;
  
  /** Recognition language code (e.g., "ja", "en", "zh") */
  language: string;
}

/**
 * Progress status for Whisper recognition tasks
 */
export interface WhisperProgress {
  /** Task ID */
  id: string;
  
  /** Current status */
  status: "processing" | "completed" | "error";
  
  /** Progress percentage (0-1) */
  progress: number;
  
  /** Current text being processed (optional) */
  currentText?: string;
  
  /** Error message if status is "error" */
  error?: string;
  
  /** Current segment number for multi-segment recognition */
  currentSegment?: number;
  
  /** Total number of segments */
  totalSegments?: number;
  
  /** Overall progress across all segments (0-1) */
  overallProgress?: number;
}

/**
 * Result from Whisper recognition
 */
export interface WhisperResult {
  /** Whether the recognition succeeded */
  success: boolean;
  
  /** Recognition data (if successful) */
  data?: {
    /** SRT content */
    srtContent: string;
    
    /** Path to the saved SRT file */
    srtPath: string;
    
    /** Audio/video duration in seconds */
    duration?: number;
    
    /** Parsed subtitle array (for segmented recognition) */
    subtitles?: any[];
  };
  
  /** Error message (if failed) */
  error?: string;
}
