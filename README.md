# Anki-MPV AI Studio

Subtitle-first Japanese video learning and Anki card creation tool.

Anki-MPV AI Studio is an Electron + Vue desktop app for studying native Japanese videos. It combines video playback, interactive subtitles, Japanese tokenization, dictionary-style word inspection, and one-click Anki card creation.

Transcription is provider-based. Users can import existing subtitles, reuse cached transcripts, run a mock cloud demo, or configure a future cloud ASR backend. Heavy local AI inference is no longer required for the default workflow.

## Features

1. Video + subtitle learning workflow
2. Import `.srt` and `.vtt` subtitles
3. Mock cloud transcription for demos
4. Interactive Japanese tokenization
5. AnkiConnect integration
6. Optional future cloud transcription backend

## Demo Without GPU

```bash
npm install
npm run start
```

Then:

1. Add or open a video.
2. Click `Start Demo Transcript`, or import a `.srt` / `.vtt` subtitle file.
3. Click subtitle text to inspect Japanese words.
4. Use `Create Anki Card` from the word detail panel.

No local speech model, local LLM model, CUDA, Metal, or GPU acceleration is required for this demo path.

## Transcription Workflow

The app uses a provider interface in `src/main/services/transcription`.

- `imported-subtitle`: Parses `.srt` and `.vtt` files into structured transcript segments.
- `mock-cloud`: Generates a realistic Japanese transcript locally for product demos. No external API call is made.
- `cloud`: Placeholder provider for a future remote ASR backend. If no API key is configured, it returns a clear configuration message.
- `cache-service`: Stores transcript JSON under the Electron app data directory and keys entries by provider, language, file path, and file modified time.

Local Whisper execution has been removed from the default workflow. Legacy code is retained only as deprecated reference code and is not used at startup.

## Core Learning Flow

1. Load a video into the queue.
2. Choose a subtitle source.
3. Review clickable transcript segments with timestamps.
4. Click Japanese text for tokenization and dictionary lookup.
5. Create Anki cards through AnkiConnect.

If AnkiConnect is not running, open Anki and enable the AnkiConnect add-on, then retry card creation.

## Development

```bash
npm install
npm run start
```

Useful validation commands:

```bash
npx tsc --noEmit
npm run package
```

## Architecture Notes

- Main process IPC handlers live under `src/main/ipc`.
- Transcription providers live under `src/main/services/transcription`.
- Renderer transcription state lives in `src/renderer/composables/useTranscription.ts`.
- The UI is built with Vue 3 and Tailwind CSS.
- The default app flow runs without local AI models.

