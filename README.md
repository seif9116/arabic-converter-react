# Arabic Audio Converter - React Version

A React TypeScript application that converts Arabic audio/video files to text and provides English translations.

## Features

- **Audio Processing**: Upload any audio or video format
- **Automatic Chunking**: Large files are split into manageable 2-minute chunks
- **Arabic Transcription**: Uses OpenAI Whisper for accurate Arabic speech recognition
- **English Translation**: Google Translate API for Arabic-to-English translation
- **Progress Tracking**: Real-time progress updates with chunk-by-chunk status
- **Download Results**: Download Arabic text, English translation, or combined results

## Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure API Keys**
   Create a `.env` file in the root directory with your API keys:
   ```
   REACT_APP_OPENAI_API_KEY=your_openai_api_key_here
   REACT_APP_GOOGLE_CLOUD_API_KEY=your_google_cloud_api_key_here
   ```

3. **Start Development Server**
   ```bash
   npm start
   ```

## API Requirements

### OpenAI API
- **Service**: Whisper (Speech-to-Text)
- **Model**: whisper-1
- **Cost**: ~$0.006 per minute of audio

### Google Cloud API
- **Service**: Translation API
- **Languages**: Arabic (ar) to English (en)
- **Setup**: Enable Translation API in Google Cloud Console

## Usage

1. **Upload File**: Drag and drop or click to select an audio/video file
2. **Process**: Click "Convert Audio to Text" to start processing
3. **Monitor Progress**: Watch real-time progress and chunk status
4. **Download Results**: Get Arabic text, English translation, or combined results

## Supported Formats

**Audio**: MP3, WAV, FLAC, AAC, OGG, M4A, WMA  
**Video**: MP4, MOV, AVI, MKV, WebM, M4V, 3GP, FLV, WMV

## Performance

- **Processing Time**: ~0.1x audio length (10 minutes = 1 minute processing)
- **File Size**: No practical limit (automatic chunking)
- **Quality**: High-quality transcription with Whisper-1 model

## Technical Stack

- **Frontend**: React 18 with TypeScript
- **APIs**: OpenAI Whisper, Google Translate
- **Audio Processing**: Web Audio API
- **Styling**: CSS with custom design system

## Migration from Alpine.js

This React version maintains all functionality from the original Alpine.js implementation:

- ✅ File upload with drag & drop
- ✅ Audio chunking and processing  
- ✅ Real-time progress tracking
- ✅ API integration (OpenAI + Google)
- ✅ Download functionality
- ✅ Error handling and status updates
- ✅ Responsive design

## Development

```bash
# Start development server
npm start

# Build for production
npm run build

# Run tests
npm test
```

## Security Notes

- API keys are stored in environment variables
- Never commit `.env` file to version control
- Consider using environment-specific API keys for production
