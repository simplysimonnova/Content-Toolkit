
import React, { useState, useRef } from 'react';
import { Volume2, Play, Loader2, Sparkles, AlertCircle, Download, Trash2, FileAudio } from 'lucide-react';
import { generateAudioSound } from './ai';

export const SoundGenerator: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioMp3Url, setAudioMp3Url] = useState<string | null>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);

  function decode(base64: string) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  async function decodeAudioData(
    data: Uint8Array,
    ctx: AudioContext,
    sampleRate: number,
    numChannels: number,
  ): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
      }
    }
    return buffer;
  }

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setIsGenerating(true);
    setError(null);
    setAudioUrl(null);
    setAudioMp3Url(null);
    setAudioBuffer(null);

    try {
      const base64Data = await generateAudioSound(prompt);

      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }

      const decodedBytes = decode(base64Data);
      const buffer = await decodeAudioData(decodedBytes, audioContextRef.current, 24000, 1);

      setAudioBuffer(buffer);

      // Prepare WAV URL
      const wavUrl = bufferToWavUrl(buffer);
      setAudioUrl(wavUrl);

      // Prepare MP3 URL
      try {
        const mp3Url = bufferToMp3Url(buffer);
        setAudioMp3Url(mp3Url);
      } catch (mp3Err) {
        console.error("MP3 Encoding failed", mp3Err);
        // We still have WAV, so we don't throw an error to the user
      }

    } catch (err: any) {
      setError(err.message || "Failed to generate sound.");
    } finally {
      setIsGenerating(false);
    }
  };

  const playSound = () => {
    if (!audioBuffer || !audioContextRef.current) return;

    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContextRef.current.destination);
    source.start();
  };

  const bufferToMp3Url = (buffer: AudioBuffer): string => {
    if (!(window as any).lamejs) {
      throw new Error("MP3 Encoder not loaded");
    }

    const channels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const mp3encoder = new (window as any).lamejs.Mp3Encoder(channels, sampleRate, 128);
    const samples = buffer.getChannelData(0);
    const sampleBlockSize = 1152;
    const mp3Data = [];

    // Convert float32 to int16
    const int16Samples = new Int16Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      int16Samples[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    for (let i = 0; i < int16Samples.length; i += sampleBlockSize) {
      const sampleChunk = int16Samples.subarray(i, i + sampleBlockSize);
      const mp3buf = mp3encoder.encodeBuffer(sampleChunk);
      if (mp3buf.length > 0) {
        mp3Data.push(mp3buf);
      }
    }
    const mp3buf = mp3encoder.flush();
    if (mp3buf.length > 0) {
      mp3Data.push(mp3buf);
    }

    const blob = new Blob(mp3Data, { type: 'audio/mp3' });
    return URL.createObjectURL(blob);
  };

  const bufferToWavUrl = (buffer: AudioBuffer): string => {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;

    const data = buffer.getChannelData(0);
    const length = data.length * 2;
    const bufferArray = new ArrayBuffer(44 + length);
    const view = new DataView(bufferArray);

    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * 2, true);
    view.setUint16(32, numChannels * 2, true);
    view.setUint16(34, bitDepth, true);
    writeString(36, 'data');
    view.setUint32(40, length, true);

    let offset = 44;
    for (let i = 0; i < data.length; i++) {
      const s = Math.max(-1, Math.min(1, data[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      offset += 2;
    }

    const blob = new Blob([bufferArray], { type: 'audio/wav' });
    return URL.createObjectURL(blob);
  };

  return (
    <div className="max-w-4xl mx-auto animate-fade-in space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
        <div className="p-4 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-500/20">
          <Volume2 className="w-8 h-8 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">AI Sound Generator</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">
            Generate success chimes, ambient textures, or short effects for your lessons.
          </p>
        </div>
      </div>

      {/* Input Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-6 space-y-4">
          <label className="text-xs font-black uppercase tracking-widest text-slate-500">Sound Description</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the sound, e.g., 'A happy sparkling success chime', 'Wind blowing through trees', 'A low ominous thud'..."
            className="w-full min-h-[120px] rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none p-4 transition-all resize-none"
          />
          <div className="flex justify-end gap-3">
            <button
              onClick={() => { setPrompt(''); setAudioUrl(null); setAudioMp3Url(null); setAudioBuffer(null); }}
              className="px-4 py-2 text-slate-500 hover:text-red-500 transition-colors flex items-center gap-2 text-sm font-medium"
            >
              <Trash2 className="w-4 h-4" />
              Clear
            </button>
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim()}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white font-black rounded-xl shadow-lg shadow-indigo-500/20 transition-all active:scale-95 text-xs uppercase tracking-widest flex items-center gap-2"
            >
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Generate Sound
            </button>
          </div>
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-xl flex items-center gap-2 border border-red-100 dark:border-red-800/50">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}
        </div>
      </div>

      {audioBuffer && (
        <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col items-center justify-center text-center animate-fade-in-up">
          <div className="mb-4 p-4 bg-slate-100 dark:bg-slate-800 rounded-full shadow-sm text-indigo-600">
            <Volume2 className="w-12 h-12" />
          </div>
          <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight mb-1">Sound Generated!</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 font-mono truncate max-w-sm">"{prompt}"</p>

          <div className="flex flex-col gap-4 w-full max-w-md">
            <button
              onClick={playSound}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black shadow-lg shadow-indigo-500/20 transition-all hover:-translate-y-0.5 active:scale-95 text-xs uppercase tracking-widest"
            >
              <Play className="w-6 h-6 fill-current" />
              Play Now
            </button>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
              {audioUrl && (
                <a
                  href={audioUrl}
                  download={`sound_${Date.now()}.wav`}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  .WAV (HQ)
                </a>
              )}

              {audioMp3Url && (
                <a
                  href={audioMp3Url}
                  download={`sound_${Date.now()}.mp3`}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <FileAudio className="w-4 h-4" />
                  .MP3 (Small)
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
