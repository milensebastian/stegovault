import React, { useState, useRef, useEffect } from 'react';
import { parseWavFile, calculateAudioCapacity, embedPayloadInWav, extractPayloadFromWav, getWaveformPeakPoints, ParsedWav } from '../utils/audioStego';
import { encryptData, decryptData } from '../crypto';
import { PasswordStrengthMeter } from './PasswordStrengthMeter';
import { Music, Upload, Download, Play, Pause, Lock, Unlock, AlertCircle, RefreshCw, Copy, Check, Volume2 } from 'lucide-react';

export const AudioStegoSection: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'encode' | 'decode'>('encode');

  // ENCODE State
  const [parsedWav, setParsedWav] = useState<ParsedWav | null>(null);
  const [secretMessage, setSecretMessage] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [isEncoding, setIsEncoding] = useState(false);
  const [encodedBlobUrl, setEncodedBlobUrl] = useState<string | null>(null);
  const [encodeError, setEncodeError] = useState<string | null>(null);

  // DECODE State
  const [stegoWav, setStegoWav] = useState<ParsedWav | null>(null);
  const [decodePassphrase, setDecodePassphrase] = useState('');
  const [isDecoding, setIsDecoding] = useState(false);
  const [decodedMessage, setDecodedMessage] = useState<string | null>(null);
  const [decodeError, setDecodeError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Audio Playback
  const [isPlayingOriginal, setIsPlayingOriginal] = useState(false);
  const [isPlayingStego, setIsPlayingStego] = useState(false);
  const audioOriginalRef = useRef<HTMLAudioElement | null>(null);
  const audioStegoRef = useRef<HTMLAudioElement | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Generate synthetic WAV cover audio (Ambient Sine Wave Chord)
  const generateSyntheticWav = () => {
    const sampleRate = 44100;
    const durationSec = 4; // 4 seconds
    const totalSamples = sampleRate * durationSec;
    const buffer = new ArrayBuffer(44 + totalSamples * 2);
    const view = new DataView(buffer);

    // RIFF header
    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + totalSamples * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // Mono
    view.setUint16(22, 1, true); // 1 channel
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true); // 16-bit
    writeString(36, 'data');
    view.setUint32(40, totalSamples * 2, true);

    // Synthesis: 440Hz A4 + 554.37Hz C#5 + 659.25Hz E5 ambient chord
    for (let i = 0; i < totalSamples; i++) {
      const t = i / sampleRate;
      const sampleFloat =
        0.3 * Math.sin(2 * Math.PI * 440 * t) +
        0.25 * Math.sin(2 * Math.PI * 554.37 * t) +
        0.2 * Math.sin(2 * Math.PI * 659.25 * t);
      const val16 = Math.floor(sampleFloat * 32767);
      view.setInt16(44 + i * 2, val16, true);
    }

    try {
      const parsed = parseWavFile(buffer);
      setParsedWav(parsed);
      setEncodedBlobUrl(null);
      setEncodeError(null);
    } catch (err: any) {
      console.error(err);
    }
  };

  useEffect(() => {
    generateSyntheticWav();
  }, []);

  // Draw Waveform on Canvas
  useEffect(() => {
    if (parsedWav && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const peaks = getWaveformPeakPoints(parsedWav.samples, canvas.width);
      const midY = canvas.height / 2;

      ctx.fillStyle = '#16181c';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = '#c9a876';
      ctx.lineWidth = 1.5;
      ctx.beginPath();

      for (let x = 0; x < peaks.length; x++) {
        const h = peaks[x] * (canvas.height / 2.2);
        ctx.moveTo(x, midY - h);
        ctx.lineTo(x, midY + h);
      }
      ctx.stroke();
    }
  }, [parsedWav]);

  // Handle WAV File Upload for ENCODE
  const handleWavUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const parsed = parseWavFile(buffer);
        setParsedWav(parsed);
        setEncodedBlobUrl(null);
        setEncodeError(null);
      } catch (err: any) {
        setEncodeError(err.message || 'Failed to parse WAV file.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Handle Audio LSB Encoding
  const handleEncode = async () => {
    if (!parsedWav) {
      setEncodeError('Please upload or generate a cover WAV audio file.');
      return;
    }

    if (!secretMessage.trim()) {
      setEncodeError('Please enter a secret text message to hide inside the audio.');
      return;
    }

    setIsEncoding(true);
    setEncodeError(null);

    try {
      const messageBytes = new TextEncoder().encode(secretMessage);
      const encryptedPayload = await encryptData(messageBytes, passphrase);

      const blob = embedPayloadInWav(parsedWav, encryptedPayload);
      const url = URL.createObjectURL(blob);
      setEncodedBlobUrl(url);
    } catch (err: any) {
      console.error(err);
      setEncodeError(err.message || 'Failed to embed payload into audio.');
    } finally {
      setIsEncoding(false);
    }
  };

  // Handle Stego WAV Upload for DECODE
  const handleStegoDecodeUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const parsed = parseWavFile(buffer);
        setStegoWav(parsed);
        setDecodedMessage(null);
        setDecodeError(null);
      } catch (err: any) {
        setDecodeError(err.message || 'Failed to parse audio file.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Handle Audio LSB Decoding
  const handleDecode = async () => {
    if (!stegoWav) {
      setDecodeError('Please select a stego WAV audio file to extract payload from.');
      return;
    }

    setIsDecoding(true);
    setDecodeError(null);

    try {
      const extractedBytes = extractPayloadFromWav(stegoWav);
      const decrypted = await decryptData(extractedBytes, decodePassphrase);
      const text = new TextDecoder('utf-8').decode(decrypted);
      setDecodedMessage(text);
    } catch (err: any) {
      console.error(err);
      setDecodeError(err.message || 'Audio decryption failed. Incorrect passphrase or unencoded WAV.');
    } finally {
      setIsDecoding(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const capacityBytes = parsedWav ? calculateAudioCapacity(parsedWav.totalSamples) : 0;
  const rawMsgBytes = new TextEncoder().encode(secretMessage).length;
  const audioOverhead = (passphrase ? 44 : 0) + 6;
  const currentBytes = rawMsgBytes > 0 ? rawMsgBytes + audioOverhead : 0;
  const capacityPct = capacityBytes ? Math.min(100, Math.round((currentBytes / capacityBytes) * 100)) : 0;

  return (
    <div className="space-y-6">
      {/* Sub-navigation Tabs */}
      <div className="flex items-center justify-between border-b border-[#24272c] pb-3">
        <div className="flex space-x-2">
          <button
            onClick={() => setActiveTab('encode')}
            className={`flex items-center space-x-2 px-4 py-2 rounded font-mono-custom text-xs tracking-wider transition-colors ${
              activeTab === 'encode'
                ? 'bg-[#c9a876] text-[#0b0c0e] font-semibold'
                : 'text-[#93979e] hover:text-[#ece8e0] bg-[#121417]'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>ENCODE AUDIO WAV</span>
          </button>
          <button
            onClick={() => setActiveTab('decode')}
            className={`flex items-center space-x-2 px-4 py-2 rounded font-mono-custom text-xs tracking-wider transition-colors ${
              activeTab === 'decode'
                ? 'bg-[#c9a876] text-[#0b0c0e] font-semibold'
                : 'text-[#93979e] hover:text-[#ece8e0] bg-[#121417]'
            }`}
          >
            <Unlock className="w-3.5 h-3.5" />
            <span>EXTRACT / DECODE</span>
          </button>
        </div>

        <div className="text-xs font-mono-custom text-[#93979e] hidden sm:block">
          PCM SAMPLE LSB EMBEDDING
        </div>
      </div>

      {/* ENCODE PANEL */}
      {activeTab === 'encode' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 space-y-6">
            {/* Audio Upload or Generate */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-mono-custom tracking-wider text-[#93979e] uppercase">
                  1. Select Cover Audio (.WAV)
                </label>
                <button
                  onClick={generateSyntheticWav}
                  className="text-[10px] font-mono-custom px-2 py-0.5 rounded bg-[#16181c] border border-[#24272c] text-[#c9a876] hover:border-[#c9a876]"
                >
                  Generate Ambient Chord WAV
                </button>
              </div>

              <div className="relative border border-dashed border-[#383c42] rounded-md bg-[#0f1114] p-6 text-center hover:border-[#c9a876] transition-colors group cursor-pointer">
                <input
                  type="file"
                  accept="audio/wav,audio/x-wav"
                  onChange={(e) => e.target.files?.[0] && handleWavUpload(e.target.files[0])}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <Music className="w-8 h-8 mx-auto text-[#53575d] group-hover:text-[#c9a876] transition-colors" />
                <p className="mt-2 text-xs font-mono-custom text-[#ece8e0]">
                  DRAG & DROP .WAV AUDIO OR CLICK TO BROWSE
                </p>
                <p className="text-[11px] text-[#93979e] mt-1">16-bit PCM Uncompressed Audio WAV</p>
              </div>

              {/* Audio Meta Specs */}
              {parsedWav && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-[#121417] p-3 rounded border border-[#24272c] text-xs font-mono-custom">
                  <div>
                    <span className="text-[10px] text-[#53575d] block">SAMPLE RATE</span>
                    <span className="text-[#ece8e0]">{parsedWav.sampleRate} Hz</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#53575d] block">DURATION</span>
                    <span className="text-[#ece8e0]">{(parsedWav.totalSamples / parsedWav.sampleRate).toFixed(1)} s</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#53575d] block">MAX CAPACITY</span>
                    <span className="text-[#8fae82] font-semibold">{capacityBytes} Bytes</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#53575d] block">CHANNELS</span>
                    <span className="text-[#c9a876]">{parsedWav.numChannels === 1 ? 'Mono' : 'Stereo'}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Secret Text Payload */}
            <div className="space-y-3 bg-[#121417] p-4 rounded border border-[#24272c]">
              <label className="block text-xs font-mono-custom tracking-wider text-[#93979e] uppercase">
                2. Secret Text Payload
              </label>
              <textarea
                value={secretMessage}
                onChange={(e) => setSecretMessage(e.target.value)}
                placeholder="Type the confidential message to hide inside PCM audio samples..."
                rows={4}
                className="w-full bg-[#16181c] border border-[#24272c] focus:border-[#c9a876] rounded p-3 text-xs font-mono-custom text-[#ece8e0] placeholder-[#53575d] focus:outline-none"
              />

              {parsedWav && (
                <div className="space-y-1 pt-1">
                  <div className="flex justify-between text-[10px] font-mono-custom">
                    <span className="text-[#93979e]">Payload: {currentBytes} Bytes</span>
                    <span className={capacityPct > 90 ? 'text-[#c47461]' : 'text-[#8fae82]'}>
                      {capacityPct}% Capacity
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-[#16181c] rounded-full overflow-hidden border border-[#24272c]">
                    <div
                      className={`h-full transition-all duration-300 ${
                        capacityPct > 90 ? 'bg-[#c47461]' : 'bg-[#c9a876]'
                      }`}
                      style={{ width: `${Math.min(100, capacityPct)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Passphrase */}
            <div className="bg-[#121417] p-4 rounded border border-[#24272c]">
              <PasswordStrengthMeter
                value={passphrase}
                onChange={setPassphrase}
                label="3. AES-256 Passphrase (Optional)"
                placeholder="Passphrase encrypts data before embedding in PCM audio..."
              />
            </div>

            <button
              onClick={handleEncode}
              disabled={isEncoding || !parsedWav}
              className="w-full py-3.5 px-4 rounded bg-[#c9a876] hover:bg-[#a58c62] disabled:opacity-40 text-[#0b0c0e] font-mono-custom font-bold text-xs tracking-widest uppercase transition-all flex items-center justify-center space-x-2 cursor-pointer"
            >
              {isEncoding ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>EMBEDDING INTO PCM SAMPLES...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>EMBED PAYLOAD & GENERATE STEGO WAV</span>
                </>
              )}
            </button>

            {encodeError && (
              <div className="flex items-center space-x-2 p-3 rounded bg-[#c47461]/10 border border-[#c47461]/30 text-[#c47461] text-xs font-mono-custom">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{encodeError}</span>
              </div>
            )}
          </div>

          {/* Right Column: Waveform Preview & Download */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-[#121417] p-4 rounded border border-[#24272c] space-y-4">
              <h3 className="text-xs font-mono-custom tracking-wider text-[#ece8e0] uppercase flex items-center space-x-2">
                <Volume2 className="w-4 h-4 text-[#c9a876]" />
                <span>Audio Waveform Signal</span>
              </h3>

              <div className="h-32 bg-[#000000] rounded overflow-hidden border border-[#24272c] flex items-center justify-center p-2">
                <canvas ref={canvasRef} width={400} height={110} className="w-full h-full" />
              </div>
            </div>

            {encodedBlobUrl && (
              <div className="bg-[#121417] p-4 rounded border border-[#8fae82]/50 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-mono-custom tracking-wider text-[#8fae82] uppercase">
                    Stego WAV Output Ready
                  </h3>
                  <span className="text-[10px] font-mono-custom px-2 py-0.5 rounded bg-[#8fae82]/10 text-[#8fae82]">
                    UNCOMPRESSED
                  </span>
                </div>

                <audio controls src={encodedBlobUrl} className="w-full" />

                <a
                  href={encodedBlobUrl}
                  download={`stego-audio-${Date.now()}.wav`}
                  className="w-full py-3 px-4 rounded bg-[#8fae82] hover:bg-[#739266] text-[#0b0c0e] font-mono-custom font-bold text-xs tracking-widest uppercase transition-all flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>DOWNLOAD STEGO .WAV</span>
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* DECODE PANEL */}
      {activeTab === 'decode' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 space-y-6">
            <div className="space-y-2">
              <label className="block text-xs font-mono-custom tracking-wider text-[#93979e] uppercase">
                1. Select Stego WAV Audio
              </label>

              <div className="relative border border-dashed border-[#383c42] rounded-md bg-[#0f1114] p-6 text-center hover:border-[#c9a876] transition-colors group cursor-pointer">
                <input
                  type="file"
                  accept="audio/wav,audio/x-wav"
                  onChange={(e) => e.target.files?.[0] && handleStegoDecodeUpload(e.target.files[0])}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <Music className="w-8 h-8 mx-auto text-[#53575d] group-hover:text-[#c9a876] transition-colors" />
                <p className="mt-2 text-xs font-mono-custom text-[#ece8e0]">
                  DRAG & DROP STEGO .WAV FILE OR CLICK TO BROWSE
                </p>
              </div>
            </div>

            <div className="space-y-4 bg-[#121417] p-4 rounded border border-[#24272c]">
              <PasswordStrengthMeter
                value={decodePassphrase}
                onChange={setDecodePassphrase}
                label="2. Decryption Passphrase"
                placeholder="Enter passphrase used during encoding..."
                showStrength={false}
              />
            </div>

            <button
              onClick={handleDecode}
              disabled={isDecoding || !stegoWav}
              className="w-full py-3.5 px-4 rounded bg-[#c9a876] hover:bg-[#a58c62] disabled:opacity-40 text-[#0b0c0e] font-mono-custom font-bold text-xs tracking-widest uppercase transition-all flex items-center justify-center space-x-2 cursor-pointer"
            >
              {isDecoding ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>EXTRACTING AUDIO LSB PAYLOAD...</span>
                </>
              ) : (
                <>
                  <Unlock className="w-4 h-4" />
                  <span>DECODE SECRET PAYLOAD</span>
                </>
              )}
            </button>

            {decodeError && (
              <div className="flex items-center space-x-2 p-3 rounded bg-[#c47461]/10 border border-[#c47461]/30 text-[#c47461] text-xs font-mono-custom">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{decodeError}</span>
              </div>
            )}
          </div>

          {/* Right Column: Output */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-[#121417] p-4 rounded border border-[#24272c] space-y-4">
              <h3 className="text-xs font-mono-custom tracking-wider text-[#ece8e0] uppercase flex items-center space-x-2">
                <Unlock className="w-4 h-4 text-[#8fae82]" />
                <span>Recovered Plaintext</span>
              </h3>

              {decodedMessage ? (
                <div className="space-y-3">
                  <textarea
                    readOnly
                    value={decodedMessage}
                    rows={8}
                    className="w-full bg-[#0f1114] border border-[#24272c] rounded p-3 text-xs font-mono-custom text-[#8fae82] focus:outline-none"
                  />
                  <button
                    onClick={() => copyToClipboard(decodedMessage)}
                    className="w-full py-2 px-3 rounded bg-[#16181c] border border-[#24272c] hover:border-[#c9a876] text-xs font-mono-custom text-[#ece8e0] flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-[#8fae82]" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'COPIED!' : 'COPY MESSAGE'}</span>
                  </button>
                </div>
              ) : (
                <div className="h-48 rounded bg-[#0f1114] border border-[#24272c] flex items-center justify-center text-xs font-mono-custom text-[#53575d]">
                  Decrypted payload output will appear here
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
