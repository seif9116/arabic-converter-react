import React, { useState, useRef, useCallback } from 'react';
import './ArabicAudioConverter.css';

interface FileInfo {
  name: string;
  size: number;
  type: string;
  lastModified: number;
}

interface Chunk {
  id: number;
  blob: Blob;
  startTime: number;
  endTime: number;
  duration: number;
  size: number;
}

interface ChunkResult {
  chunkIndex: number;
  startTime: number;
  endTime: number;
  arabicText?: string;
  englishText?: string;
  success: boolean;
  error?: string;
}

interface FinalText {
  arabic: string;
  english: string;
}

interface ProcessedAudio {
  originalBlob?: Blob;
  processedBlob?: Blob;
  isGenerated: boolean;
}

interface TTSAudio {
  englishAudioBlob?: Blob;
  isGenerated: boolean;
}

const ArabicAudioConverter: React.FC = () => {
  const [file, setFile] = useState<FileInfo | null>(null);
  const [actualFile, setActualFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'processing' | 'completed' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [results, setResults] = useState<ChunkResult[]>([]);
  const [finalText, setFinalText] = useState<FinalText>({ arabic: '', english: '' });
  const [processing, setProcessing] = useState(false);
  const [currentStatus, setCurrentStatus] = useState('Ready to process audio');
  const [currentChunk, setCurrentChunk] = useState(-1);
  const [processedAudio, setProcessedAudio] = useState<ProcessedAudio>({ isGenerated: false });
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [chunkProgressExpanded, setChunkProgressExpanded] = useState(false);
  const [ttsAudio, setTtsAudio] = useState<TTSAudio>({ isGenerated: false });
  const [isGeneratingTTS, setIsGeneratingTTS] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chunkSize = 120; // 2 minutes

  const isValidMediaFile = (file: File): boolean => {
    console.log('File validation - Name:', file.name, 'Type:', file.type, 'Size:', file.size);
    
    // Check MIME type first - include common iPhone/MPEG-4 audio types
    if (file.type.startsWith('audio/') || 
        file.type.startsWith('video/') ||
        file.type === 'application/octet-stream' || // iPhone sometimes uses this
        file.type === '') { // Empty MIME type fallback
      console.log('MIME type accepted:', file.type);
      
      // For generic MIME types, check extension
      if (file.type === 'application/octet-stream' || file.type === '') {
        const filename = file.name.toLowerCase();
        const validExtensions = [
          // Audio formats
          '.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a', '.wma',
          // Video formats  
          '.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.3gp', '.flv', '.wmv'
        ];
        const hasValidExt = validExtensions.some(ext => filename.endsWith(ext));
        console.log('Extension check for generic MIME:', hasValidExt);
        return hasValidExt;
      }
      
      return true;
    }
    
    // Check file extension for cases where MIME type might not be detected properly
    const filename = file.name.toLowerCase();
    const validExtensions = [
      // Audio formats - expanded for iPhone compatibility
      '.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a', '.wma',
      '.caf', '.aiff', '.au', '.amr', // Additional iPhone formats
      // Video formats  
      '.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.3gp', '.flv', '.wmv'
    ];
    
    const hasValidExt = validExtensions.some(ext => filename.endsWith(ext));
    console.log('Extension validation result:', hasValidExt, 'for file:', filename);
    return hasValidExt;
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    const uploadedFile = files[0];
    console.log('Selected file:', uploadedFile);
    
    if (uploadedFile && isValidMediaFile(uploadedFile)) {
      // Clear any existing file first
      setFile(null);
      setActualFile(null);
      
      // Create a plain object for React state
      const fileInfo: FileInfo = {
        name: uploadedFile.name,
        size: uploadedFile.size,
        type: uploadedFile.type,
        lastModified: uploadedFile.lastModified
      };
      
      setFile(fileInfo);
      setActualFile(uploadedFile);
      setStatus('idle');
      setProgress(0);
      setChunks([]);
      setResults([]);
      setFinalText({ arabic: '', english: '' });
      setCurrentStatus('Ready to process audio');
      setCurrentChunk(-1);
      setProcessedAudio({ isGenerated: false });
      setTtsAudio({ isGenerated: false });
      
      console.log(`File loaded: ${uploadedFile.name}`);
      console.log(`File size: ${(uploadedFile.size / 1024 / 1024).toFixed(2)} MB`);
    } else {
      alert('Please select a valid audio or video file');
    }
  };

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.classList.remove('dragover');
    
    const files = event.dataTransfer.files;
    if (files.length > 0) {
      const uploadedFile = files[0];
      console.log('Dropped file:', uploadedFile);
      
      if (isValidMediaFile(uploadedFile)) {
        const fileInfo: FileInfo = {
          name: uploadedFile.name,
          size: uploadedFile.size,
          type: uploadedFile.type,
          lastModified: uploadedFile.lastModified
        };
        
        setFile(fileInfo);
        setActualFile(uploadedFile);
        setStatus('idle');
        setProgress(0);
        setChunks([]);
        setResults([]);
        setFinalText({ arabic: '', english: '' });
        setCurrentStatus('Ready to process audio');
        setCurrentChunk(-1);
        setProcessedAudio({ isGenerated: false });
        setTtsAudio({ isGenerated: false });
        
        console.log('File dropped successfully:', fileInfo);
      } else {
        alert('Please drop a valid audio or video file');
      }
    }
  }, []);

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.classList.add('dragover');
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.classList.remove('dragover');
  };

  const getProcessingStatus = (): string => {
    if (isGeneratingTTS) return 'Generating English text-to-speech audio...';
    if (isGeneratingAudio) return 'Generating processed audio file...';
    if (progress <= 5) return 'Initializing...';
    if (progress <= 15) return 'Splitting audio into 2-minute chunks...';
    if (progress <= 75) return 'Transcribing and translating chunks (this will take significantly longer)...';
    if (progress <= 85) return 'Combining results...';
    if (progress <= 95) return 'Generating audio files...';
    if (progress <= 100) return 'Finalizing...';
    return 'Processing...';
  };

  const audioBufferToBlob = async (audioBuffer: AudioBuffer): Promise<Blob> => {
    const numberOfChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;
    const sampleRate = audioBuffer.sampleRate;
    const arrayBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2);
    const view = new DataView(arrayBuffer);
    
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * numberOfChannels * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numberOfChannels * 2, true);
    view.setUint16(32, numberOfChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length * numberOfChannels * 2, true);
    
    const channelData = [];
    for (let channel = 0; channel < numberOfChannels; channel++) {
      channelData.push(audioBuffer.getChannelData(channel));
    }
    
    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, channelData[channel][i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
      }
    }
    
    return new Blob([arrayBuffer], { type: 'audio/wav' });
  };

  const splitAudioIntoChunks = async (audioFile: File): Promise<Chunk[]> => {
    return new Promise((resolve, reject) => {
      console.log(`📁 Reading audio file: ${audioFile.name} (${(audioFile.size / 1024 / 1024).toFixed(2)} MB)`);
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextClass();
      const fileReader = new FileReader();

      fileReader.onload = async (e) => {
        try {
          console.log('🔄 Decoding audio data...');
          const arrayBuffer = e.target?.result as ArrayBuffer;
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          
          const duration = audioBuffer.duration;
          const sampleRate = audioBuffer.sampleRate;
          const chunkDuration = chunkSize;
          const numberOfChannels = audioBuffer.numberOfChannels;
          
          console.log(`📊 Audio info: ${duration.toFixed(2)}s, ${sampleRate}Hz, ${numberOfChannels} channels`);
          console.log(`✂️ Creating ${chunkDuration}s chunks...`);
          
          const expectedChunks = Math.ceil(duration / chunkDuration);
          console.log(`📦 Expected ${expectedChunks} chunks`);
          
          const chunks: Chunk[] = [];
          let totalChunkSize = 0;
          
          for (let start = 0; start < duration; start += chunkDuration) {
            const end = Math.min(start + chunkDuration, duration);
            const chunkLength = (end - start) * sampleRate;
            
            console.log(`Creating chunk ${chunks.length + 1}/${expectedChunks}: ${start.toFixed(1)}s - ${end.toFixed(1)}s`);
            
            const chunkBuffer = audioContext.createBuffer(
              numberOfChannels,
              chunkLength,
              sampleRate
            );
            
            for (let channel = 0; channel < numberOfChannels; channel++) {
              const channelData = audioBuffer.getChannelData(channel);
              const chunkChannelData = chunkBuffer.getChannelData(channel);
              
              for (let i = 0; i < chunkLength; i++) {
                const sourceIndex = Math.floor(start * sampleRate) + i;
                chunkChannelData[i] = sourceIndex < channelData.length ? channelData[sourceIndex] : 0;
              }
            }
            
            const chunkBlob = await audioBufferToBlob(chunkBuffer);
            const chunkSizeMB = (chunkBlob.size / 1024 / 1024).toFixed(2);
            totalChunkSize += chunkBlob.size;
            
            console.log(`📦 Chunk ${chunks.length + 1} created: ${chunkSizeMB} MB`);
            
            chunks.push({
              id: chunks.length,
              blob: chunkBlob,
              startTime: start,
              endTime: end,
              duration: end - start,
              size: chunkBlob.size
            });
          }
          
          const totalSizeMB = (totalChunkSize / 1024 / 1024).toFixed(2);
          const originalSizeMB = (audioFile.size / 1024 / 1024).toFixed(2);
          const sizeIncrease = ((totalChunkSize / audioFile.size - 1) * 100).toFixed(1);
          
          console.log(`✅ Splitting complete!`);
          console.log(`📊 Original: ${originalSizeMB} MB → Chunks: ${totalSizeMB} MB (+${sizeIncrease}%)`);
          
          resolve(chunks);
        } catch (error) {
          console.error('❌ Audio splitting failed:', error);
          reject(error);
        }
      };

      fileReader.onerror = (error) => {
        console.error('❌ File reading failed:', error);
        reject(error);
      };
      fileReader.readAsArrayBuffer(audioFile);
    });
  };

  const transcribeChunk = async (chunk: Chunk, chunkIndex: number): Promise<string> => {
    console.log(`🎤 Transcribing chunk ${chunkIndex + 1}...`);
    const formData = new FormData();
    formData.append('file', chunk.blob, `chunk_${chunkIndex}.wav`);
    formData.append('model', 'whisper-1');

    const response = await fetch('/api/transcribe', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI Transcription API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    console.log(`📝 Transcription: "${data.text}"`);
    return data.text;
  };

  const translateChunk = async (text: string, chunkIndex: number): Promise<string> => {
    console.log(`🔄 Translating chunk ${chunkIndex + 1}...`);
    const response = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, target: 'en', source: 'ar' }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google Translate API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const translatedText = data.data.translations[0].translatedText;
    console.log(`🌐 Translation: "${translatedText}"`);
    return translatedText;
  };

  const processChunk = async (chunk: Chunk, chunkIndex: number, totalChunks: number): Promise<ChunkResult> => {
    const chunkSizeMB = (chunk.size / 1024 / 1024).toFixed(2);
    console.log(`🎤 Processing chunk ${chunkIndex + 1}/${totalChunks}`);
    console.log(`⏱️ Time: ${chunk.startTime.toFixed(1)}s - ${chunk.endTime.toFixed(1)}s (${chunk.duration.toFixed(1)}s duration)`);
    console.log(`💾 Size: ${chunkSizeMB} MB`);
    
    try {
      setCurrentStatus(`Transcribing Arabic audio for chunk ${chunkIndex + 1}...`);
      const arabicText = await transcribeChunk(chunk, chunkIndex);
      let englishText = '';
      
      if (arabicText && arabicText.trim()) {
        try {
          setCurrentStatus(`Translating chunk ${chunkIndex + 1} to English...`);
          englishText = await translateChunk(arabicText, chunkIndex);
          console.log(`🌐 Translation completed for chunk ${chunkIndex + 1}`);
        } catch (error: any) {
          console.log(`⚠️ Translation failed for chunk ${chunkIndex + 1}: ${error.message}`);
        }
      }
      
      console.log(`✅ Chunk ${chunkIndex + 1} completed successfully`);
      
      return {
        chunkIndex,
        startTime: chunk.startTime,
        endTime: chunk.endTime,
        arabicText,
        englishText,
        success: true
      };
      
    } catch (error: any) {
      console.error(`❌ Error processing chunk ${chunkIndex + 1}:`, error);
      return {
        chunkIndex,
        startTime: chunk.startTime,
        endTime: chunk.endTime,
        error: error.message,
        success: false
      };
    }
  };

  // TTS functionality
  const chunkTextForTTS = (text: string, maxChars: number = 4000): string[] => {
    if (text.length <= maxChars) {
      return [text];
    }
    
    const chunks: string[] = [];
    const sentences = text.split(/[.!?]/).filter(s => s.trim().length > 0);
    
    let currentChunk = '';
    
    for (const sentence of sentences) {
      const sentenceWithPunct = sentence.trim() + '.';
      if (sentenceWithPunct.length > maxChars) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }
        
        // Split long sentence by words
        const words = sentenceWithPunct.split(' ');
        let wordChunk = '';
        for (const word of words) {
          if (wordChunk.length + word.length + 1 <= maxChars) {
            wordChunk += (wordChunk ? ' ' : '') + word;
          } else {
            if (wordChunk) chunks.push(wordChunk.trim());
            wordChunk = word;
          }
        }
        if (wordChunk) chunks.push(wordChunk.trim());
      } else if (currentChunk.length + sentenceWithPunct.length + 1 <= maxChars) {
        currentChunk += (currentChunk ? ' ' : '') + sentenceWithPunct;
      } else {
        if (currentChunk) chunks.push(currentChunk.trim());
        currentChunk = sentenceWithPunct;
      }
    }
    
    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks.filter(chunk => chunk.length > 0);
  };

  const textToSpeechBlob = async (text: string): Promise<Blob> => {
    console.log(`🎤 Converting text to speech: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
    
    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        input: text,
        voice: 'onyx',
        speed: 1.0
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI TTS API error (${response.status}): ${errorText}`);
    }
    
    const audioBlob = await response.blob();
    console.log(`✅ TTS successful, audio size: ${(audioBlob.size / 1024).toFixed(2)} KB`);
    
    return audioBlob;
  };

  const combineAudioBlobs = async (audioBlobs: Blob[]): Promise<Blob> => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextClass();
      const audioBuffers: AudioBuffer[] = [];
      
      for (const blob of audioBlobs) {
        const arrayBuffer = await blob.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        audioBuffers.push(audioBuffer);
      }
      
      const totalLength = audioBuffers.reduce((sum, buffer) => sum + buffer.length, 0);
      const sampleRate = audioBuffers[0]?.sampleRate || 44100;
      const numberOfChannels = audioBuffers[0]?.numberOfChannels || 2;
      
      const combinedBuffer = audioContext.createBuffer(numberOfChannels, totalLength, sampleRate);
      
      let offset = 0;
      for (const buffer of audioBuffers) {
        for (let channel = 0; channel < numberOfChannels; channel++) {
          const channelData = buffer.getChannelData(channel);
          const combinedChannelData = combinedBuffer.getChannelData(channel);
          
          for (let i = 0; i < channelData.length; i++) {
            if (offset + i < combinedChannelData.length) {
              combinedChannelData[offset + i] = channelData[i];
            }
          }
        }
        offset += buffer.length;
      }
      
      return await audioBufferToBlob(combinedBuffer);
      
    } catch (error) {
      console.error('❌ Error combining audio blobs:', error);
      throw error;
    }
  };

  const generateEnglishTTSAudio = async (englishText: string): Promise<Blob> => {
    if (!englishText || englishText.trim() === '') {
      throw new Error('No English text available for TTS generation');
    }

    try {
      console.log(`🎵 Generating English TTS audio from text (${englishText.length} characters)...`);
      
      const chunks = chunkTextForTTS(englishText, 4000);
      
      if (chunks.length === 1) {
        console.log('📝 Single chunk, generating audio directly');
        return await textToSpeechBlob(chunks[0]);
      }
      
      console.log(`📝 Processing ${chunks.length} text chunks for TTS generation...`);
      setCurrentStatus(`Splitting English text into ${chunks.length} chunks for TTS generation...`);
      const audioBlobs: Blob[] = [];
      
      for (let i = 0; i < chunks.length; i++) {
        setCurrentStatus(`Generating TTS for chunk ${i + 1}/${chunks.length}...`);
        console.log(`🎤 Generating TTS for chunk ${i + 1}/${chunks.length}...`);
        const audioBlob = await textToSpeechBlob(chunks[i]);
        audioBlobs.push(audioBlob);
        console.log(`✅ TTS chunk ${i + 1}/${chunks.length} completed successfully`);
        setCurrentStatus(`✅ TTS chunk ${i + 1}/${chunks.length} completed successfully`);
        
        if (i < chunks.length - 1) {
          // Brief pause to show success message
          await new Promise(resolve => setTimeout(resolve, 1000));
          setCurrentStatus('⏳ Waiting 1 second between TTS requests...');
          console.log('⏳ Waiting 1 second between TTS requests...');
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }
      
      console.log('🔗 Combining TTS audio chunks...');
      const combinedAudio = await combineAudioBlobs(audioBlobs);
      
      console.log(`✅ English TTS audio generated successfully! Size: ${(combinedAudio.size / 1024 / 1024).toFixed(2)} MB`);
      
      return combinedAudio;
      
    } catch (error: any) {
      console.error(`❌ Error generating English TTS audio:`, error);
      throw error;
    }
  };

  const processAudio = async () => {
    if (!file || !actualFile) return;
    
    setProcessing(true);
    setStatus('processing');
    setProgress(0);
    setCurrentStatus('Initializing process...');
    setCurrentChunk(-1);
    
    console.log('🚀 Starting Arabic audio conversion process...');
    console.log(`📁 File: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);

    try {
      setProgress(5);
      setCurrentStatus('Splitting audio into 2-minute chunks...');
      console.log('\n=== STEP 1: AUDIO SPLITTING ===');
      const audioChunks = await splitAudioIntoChunks(actualFile);
      setChunks(audioChunks);
      
      const chunksToProcess = audioChunks;
      
      setProgress(15);
      setCurrentStatus(`Processing ${chunksToProcess.length} chunks (transcribe & translate)...`);
      console.log(`\n=== STEP 2: PROCESSING ${chunksToProcess.length} CHUNKS (TRANSCRIBE & TRANSLATE) ===`);
      
      const chunkResults: ChunkResult[] = [];
      const totalChunks = chunksToProcess.length;
      
      for (let i = 0; i < chunksToProcess.length; i++) {
        const chunk = chunksToProcess[i];
        setCurrentChunk(i);
        setCurrentStatus(`Processing chunk ${i + 1} of ${totalChunks} - Transcribing Arabic audio...`);
        console.log(`\n--- Processing Chunk ${i + 1}/${totalChunks} ---`);
        
        const result = await processChunk(chunk, i, totalChunks);
        chunkResults.push(result);
        
        // Update results state immediately after each chunk to show progress
        setResults([...chunkResults]);
        
        if (!result.success) {
          console.log(`❌ Chunk ${i + 1} failed: ${result.error}`);
          setCurrentStatus(`Chunk ${i + 1} failed: ${result.error}`);
        } else {
          setCurrentStatus(`Completed chunk ${i + 1} of ${totalChunks}`);
        }
        
        const chunkProgress = 15 + (70 * (i + 1)) / totalChunks;
        setProgress(Math.round(chunkProgress));
        
        if (i < totalChunks - 1) {
          setCurrentStatus('Waiting 2 seconds (API rate limiting)...');
          console.log('⏳ Waiting 2 seconds (rate limiting for both APIs)...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      setProgress(85);
      setCurrentStatus('Combining all transcription results...');
      setCurrentChunk(-1);
      console.log('\n=== STEP 3: CONCATENATING RESULTS ===');
      setResults(chunkResults);
      
      const successfulResults = chunkResults.filter(r => r.success);
      const failedResults = chunkResults.filter(r => !r.success);
      
      console.log(`📊 Processing summary:`);
      console.log(`✅ Successful: ${successfulResults.length}`);
      console.log(`❌ Failed: ${failedResults.length}`);
      
      const combinedArabic = successfulResults.map(r => r.arabicText).filter(text => text && text.trim()).join(' ');
      const combinedEnglish = successfulResults.map(r => r.englishText).filter(text => text && text.trim()).join(' ');
      
      setFinalText({
        arabic: combinedArabic,
        english: combinedEnglish
      });
      
      setProgress(85);
      setCurrentStatus('Preparing audio files for download...');
      setIsGeneratingAudio(true);
      
      // Generate processed audio file with chunks combined
      console.log('\n=== STEP 4: GENERATING PROCESSED AUDIO FILE ===');
      const processedBlob = await generateProcessedAudioFile(audioChunks);
      setProcessedAudio({
        originalBlob: actualFile,
        processedBlob: processedBlob,
        isGenerated: true
      });
      setIsGeneratingAudio(false);
      
      // Generate TTS audio from English text
      setProgress(90);
      setCurrentStatus('Generating English text-to-speech audio...');
      setIsGeneratingTTS(true);
      console.log('\n=== STEP 5: GENERATING ENGLISH TTS AUDIO ===');
      
      if (combinedEnglish && combinedEnglish.trim()) {
        try {
          const englishAudioBlob = await generateEnglishTTSAudio(combinedEnglish);
          setTtsAudio({
            englishAudioBlob: englishAudioBlob,
            isGenerated: true
          });
          console.log(`✅ English TTS audio generated: ${(englishAudioBlob.size / 1024 / 1024).toFixed(2)} MB`);
        } catch (error: any) {
          console.error('❌ Failed to generate English TTS audio:', error);
          setTtsAudio({ isGenerated: false });
        }
      } else {
        console.log('⚠️ No English text available for TTS generation');
        setTtsAudio({ isGenerated: false });
      }
      
      setProgress(100);
      setStatus('completed');
      setIsGeneratingTTS(false);
      setCurrentStatus(`✅ Processing complete! Generated ${combinedArabic.length} characters of Arabic text, ${combinedEnglish.length} characters of English translation, processed audio file, and ${ttsAudio.isGenerated ? 'English TTS audio' : 'processed audio only'}.`);
      
      console.log('\n🎉 PROCESSING COMPLETE!');
      console.log(`📝 Total Arabic text: ${combinedArabic.length} characters`);
      console.log(`📝 Total English text: ${combinedEnglish.length} characters`);
      console.log(`🎵 Processed audio file: ${(processedBlob.size / 1024 / 1024).toFixed(2)} MB`);
      
    } catch (error: any) {
      console.error('❌ Processing failed:', error);
      setStatus('error');
      setCurrentStatus(`❌ Error: ${error.message}`);
      setCurrentChunk(-1);
    } finally {
      setProcessing(false);
      setIsGeneratingAudio(false);
    }
  };

  const downloadText = (text: string, filename: string) => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadArabicText = () => {
    if (finalText.arabic) {
      downloadText(finalText.arabic, 'arabic_transcription.txt');
    }
  };

  const downloadEnglishText = () => {
    if (finalText.english) {
      downloadText(finalText.english, 'english_translation.txt');
    }
  };

  const generateProcessedAudioFile = async (audioChunks: Chunk[]): Promise<Blob> => {
    console.log('🎵 Generating processed audio file from chunks...');
    
    try {
      // Create a new audio context for combining chunks
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextClass();
      
      // Calculate total duration
      const totalDuration = audioChunks.reduce((sum, chunk) => sum + chunk.duration, 0);
      const sampleRate = 44100; // Standard sample rate
      const channels = 2; // Stereo
      
      console.log(`🎵 Creating combined audio buffer: ${totalDuration.toFixed(2)}s at ${sampleRate}Hz`);
      
      // Create a combined audio buffer
      const combinedBuffer = audioContext.createBuffer(channels, Math.floor(totalDuration * sampleRate), sampleRate);
      
      let currentOffset = 0;
      
      for (let i = 0; i < audioChunks.length; i++) {
        const chunk = audioChunks[i];
        console.log(`🎵 Processing chunk ${i + 1}/${audioChunks.length}`);
        
        try {
          // Convert chunk blob back to audio buffer
          const arrayBuffer = await chunk.blob.arrayBuffer();
          const chunkBuffer = await audioContext.decodeAudioData(arrayBuffer);
          
          // Copy chunk data to combined buffer
          const chunkLength = chunkBuffer.length;
          const chunkChannels = Math.min(chunkBuffer.numberOfChannels, channels);
          
          for (let channel = 0; channel < chunkChannels; channel++) {
            const sourceData = chunkBuffer.getChannelData(channel);
            const targetData = combinedBuffer.getChannelData(channel);
            
            for (let sample = 0; sample < chunkLength && currentOffset + sample < targetData.length; sample++) {
              targetData[currentOffset + sample] = sourceData[sample];
            }
          }
          
          // Fill additional channels if needed (mono to stereo)
          if (chunkChannels === 1 && channels === 2) {
            const sourceData = chunkBuffer.getChannelData(0);
            const targetData = combinedBuffer.getChannelData(1);
            
            for (let sample = 0; sample < chunkLength && currentOffset + sample < targetData.length; sample++) {
              targetData[currentOffset + sample] = sourceData[sample];
            }
          }
          
          currentOffset += chunkLength;
        } catch (error) {
          console.warn(`⚠️ Failed to process chunk ${i + 1}, skipping:`, error);
        }
      }
      
      console.log('🎵 Converting combined buffer to downloadable format...');
      
      // Convert the combined buffer to a downloadable blob
      const processedBlob = await audioBufferToBlob(combinedBuffer);
      
      console.log(`✅ Processed audio file generated: ${(processedBlob.size / 1024 / 1024).toFixed(2)} MB`);
      return processedBlob;
      
    } catch (error) {
      console.error('❌ Error generating processed audio:', error);
      // Return empty blob as fallback
      return new Blob([], { type: 'audio/wav' });
    }
  };

  const downloadOriginalAudio = () => {
    if (processedAudio.originalBlob && actualFile) {
      const url = URL.createObjectURL(actualFile);
      const a = document.createElement('a');
      a.href = url;
      a.download = `original_${actualFile.name}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };


  const downloadEnglishTTSAudio = () => {
    if (ttsAudio.englishAudioBlob && ttsAudio.isGenerated) {
      const url = URL.createObjectURL(ttsAudio.englishAudioBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `english_tts_${file?.name?.replace(/\.[^/.]+$/, '')}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      console.log('✅ English TTS audio download started!');
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getChunkResult = (index: number): ChunkResult | undefined => {
    return results.find(r => r.chunkIndex === index);
  };

  return (
    <div className="arabic-audio-converter">
      <div id="content-wrapper">
        <header>
          <h1><a href="../../">Seif Eldin Metwally</a></h1>
          <nav>
            <a href="../../">Home</a>
            <a href="../../#/blog">Blog</a>
          </nav>
        </header>
        
        <main>
          <hr />
          <h2 style={{ textAlign: 'center', marginBottom: '2rem' }}>Arabic Audio Converter</h2>
          
          {/* File Upload */}
          <div 
            className="upload-area"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <svg style={{ width: '48px', height: '48px', marginBottom: '1rem', color: '#6b7280' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
              </svg>
              
              <p style={{ marginBottom: '0.5rem', fontWeight: 500 }}>
                <span style={{ color: '#3b82f6' }}>Click to upload</span> your Arabic audio or video file
              </p>
              <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                Any audio or video format, any size (will be chunked automatically)
              </p>
              <p style={{ fontSize: '0.75rem', color: '#9ca3af', fontStyle: 'italic' }}>
                iOS users: Select any file type - validation happens after selection
              </p>
              
              {file && (
                <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                  <p style={{ color: '#3b82f6', fontWeight: 500 }}>{file.name}</p>
                  <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                    Size: {(file.size / 1024 / 1024).toFixed(2)} MB | 
                    Est. Duration: ~{Math.round(file.size / 1024 / 1024)} minutes
                  </p>
                </div>
              )}
            </div>
            
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
          </div>

          {/* Process Button */}
          <div style={{ textAlign: 'center', margin: '2rem 0' }}>
            <button 
              onClick={processAudio}
              disabled={!file || processing}
              className="btn btn-primary"
            >
              {processing ? (
                <div>
                  <div className="spinner"></div>
                  <span>{getProcessingStatus()}</span>
                </div>
              ) : (
                <div>
                  <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3M7 7h10a2 2 0 012 2v10a2 2 0 01-2 2H7a2 2 0 01-2-2V9a2 2 0 012-2z"></path>
                  </svg>
                  <span>Convert Audio to Text</span>
                </div>
              )}
            </button>
          </div>

          {/* Progress */}
          {processing && (
            <div style={{ marginBottom: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.875rem', color: '#6b7280' }}>
                <span>{isGeneratingAudio ? 'Generating audio files...' : `Processing ${chunks.length} chunks...`}</span>
                <span>{progress}%</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progress}%` }}></div>
              </div>
              
              <div style={{ marginTop: '1rem', padding: '1rem', background: '#f3f4f6', borderRadius: '6px', borderLeft: '4px solid #3b82f6' }}>
                <div style={{ fontWeight: 500, color: '#374151', marginBottom: '0.5rem' }}>Current Status:</div>
                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                  {isGeneratingTTS && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div className="spinner" style={{ width: '16px', height: '16px' }}></div>
                      <span>Generating English text-to-speech audio...</span>
                    </div>
                  )}
                  {isGeneratingAudio && !isGeneratingTTS && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div className="spinner" style={{ width: '16px', height: '16px' }}></div>
                      <span>Generating processed audio file...</span>
                    </div>
                  )}
                  {!isGeneratingAudio && !isGeneratingTTS && currentStatus}
                </div>
                
                {currentChunk >= 0 && chunks.length > 0 && !isGeneratingAudio && (
                  <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#6b7280' }}>
                    Processing chunk {currentChunk + 1} of {chunks.length}
                    ({formatTime(chunks[currentChunk]?.startTime || 0)} - 
                     {formatTime(chunks[currentChunk]?.endTime || 0)})
                  </div>
                )}
                
                {isGeneratingAudio && (
                  <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#6b7280' }}>
                    Combining {chunks.length} audio chunks into downloadable file...
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Chunk Progress */}
          {chunks.length > 0 && (
            <div style={{ marginBottom: '2rem' }}>
              <div 
                onClick={() => setChunkProgressExpanded(!chunkProgressExpanded)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  padding: '0.75rem',
                  background: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  marginBottom: chunkProgressExpanded ? '1rem' : 0
                }}
              >
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 500 }}>
                  Chunk Progress ({chunks.length} chunks)
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                    {results.filter(r => r.success).length}/{chunks.length} completed
                  </span>
                  <svg 
                    style={{ 
                      width: '20px', 
                      height: '20px', 
                      transform: chunkProgressExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s'
                    }} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
              
              {chunkProgressExpanded && (
                <div style={{ 
                  border: '1px solid #e5e7eb', 
                  borderTop: 'none',
                  borderRadius: '0 0 6px 6px',
                  maxHeight: '300px',
                  overflowY: 'auto'
                }}>
                  {chunks.map((chunk, index) => (
                    <div key={index} className="chunk-item" style={{ margin: 0, borderRadius: 0 }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                        Chunk {index + 1}
                      </span>
                      <span style={{ fontSize: '0.875rem', color: '#6b7280', marginLeft: '1rem' }}>
                        {formatTime(chunk.startTime)} - {formatTime(chunk.endTime)}
                      </span>
                      <span style={{ fontSize: '0.875rem', color: '#6b7280', marginLeft: '0.5rem' }}>
                        ({(chunk.size / 1024 / 1024).toFixed(1)} MB)
                      </span>
                      <div 
                        className={`chunk-status ${
                          getChunkResult(index)?.success ? 'success' :
                          getChunkResult(index)?.error ? 'error' :
                          !getChunkResult(index) && processing ? 'processing' : 'pending'
                        }`}
                      ></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Download Options */}
          {status === 'completed' && finalText.arabic && (
            <div style={{ marginTop: '2rem' }}>
              <h4 style={{ fontWeight: 600, color: '#374151', marginBottom: '1rem' }}>Download Options:</h4>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                {/* Text Downloads */}
                <div>
                  <h5 style={{ fontSize: '0.875rem', fontWeight: 500, color: '#6b7280', marginBottom: '0.5rem' }}>Text Files</h5>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <button onClick={downloadArabicText} className="btn btn-secondary" style={{ fontSize: '0.875rem' }}>
                      <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                      </svg>
                      Arabic Transcript
                    </button>
                    
                    <button onClick={downloadEnglishText} className="btn btn-secondary" style={{ fontSize: '0.875rem' }}>
                      <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                      </svg>
                      English Translation
                    </button>
                  </div>
                </div>
                
                {/* Audio Downloads */}
                <div>
                  <h5 style={{ fontSize: '0.875rem', fontWeight: 500, color: '#6b7280', marginBottom: '0.5rem' }}>Audio Files</h5>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <button 
                      onClick={downloadOriginalAudio} 
                      className="btn btn-primary" 
                      style={{ fontSize: '0.875rem' }}
                      disabled={!actualFile}
                    >
                      <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"></path>
                      </svg>
                      Original Audio
                    </button>

                    <button 
                      onClick={downloadEnglishTTSAudio} 
                      className="btn btn-secondary" 
                      style={{ fontSize: '0.875rem' }}
                      disabled={!ttsAudio.isGenerated}
                    >
                      <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 12.536a4 4 0 010-5.66M13.05 10.05a2 2 0 010 2.83m-2.12 4.95a1 1 0 01-1.42 0L6 14.34H4a2 2 0 01-2-2V8a2 2 0 012-2h2l3.5-3.54a1 1 0 011.42 0l.08.08v11.04z"></path>
                      </svg>
                      English TTS Audio (.mp3)
                    </button>
                  </div>
                </div>
              </div>
              
              {(processedAudio.isGenerated || ttsAudio.isGenerated) && (
                <div style={{ padding: '0.75rem', background: '#ecfdf5', border: '1px solid #10b981', borderRadius: '6px', fontSize: '0.875rem', marginBottom: '2rem' }}>
                  <div style={{ fontWeight: 500, color: '#065f46', marginBottom: '0.25rem' }}>✅ Files ready for download!</div>
                  {ttsAudio.isGenerated && (
                    <div style={{ color: '#047857' }}>
                      English TTS audio: {((ttsAudio.englishAudioBlob?.size || 0) / 1024 / 1024).toFixed(2)} MB MP3 format
                    </div>
                  )}
                  {!ttsAudio.isGenerated && (
                    <div style={{ color: '#f59e0b', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                      ⚠️ TTS audio generation failed - text files and original audio available
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Final Results - Transcripts */}
          {status === 'completed' && finalText.arabic && (
            <div>
              <div className="transcript-box arabic">
                <h3 style={{ marginBottom: '1rem', color: '#374151' }}>
                  Complete Arabic Transcript:
                </h3>
                <p style={{ color: '#4b5563', lineHeight: 1.6 }}>{finalText.arabic}</p>
              </div>

              <div className="transcript-box">
                <h3 style={{ marginBottom: '1rem', color: '#374151' }}>
                  Complete English Translation:
                </h3>
                <p style={{ color: '#4b5563', lineHeight: 1.6 }}>{finalText.english}</p>
              </div>
            </div>
          )}

          {/* Usage Notes */}
          <div style={{ marginTop: '2rem', padding: '1rem', background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '8px' }}>
            <h4 style={{ fontWeight: 600, color: '#92400e', marginBottom: '0.5rem' }}>Large File Processing:</h4>
            <ul style={{ fontSize: '0.875rem', color: '#92400e', margin: 0, paddingLeft: '1.25rem' }}>
              <li>Audio files are automatically split into manageable chunks</li>
              <li>Each chunk is processed separately and then combined</li>
              <li>Larger files will take longer but can handle hours of audio</li>
              <li><strong>Processing includes TTS generation which takes significantly longer</strong></li>
              <li>Total processing time ≈ 0.2x audio length (10 minutes audio ≈ 2-3 minutes processing)</li>
              <li>Cost scales with file size: ~$0.008 per minute of audio (including TTS)</li>
              <li>Generates both processed original audio and English text-to-speech audio</li>
            </ul>
          </div>
        </main>
      </div>
    </div>
  );
};

export default ArabicAudioConverter;