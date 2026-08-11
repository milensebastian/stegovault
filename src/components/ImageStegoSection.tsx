import React, { useState, useRef, useEffect } from 'react';
import { PasswordStrengthMeter } from './PasswordStrengthMeter';
import { calculateImageCapacity, embedPayloadInImageData, extractPayloadFromImageData } from '../utils/imageStego';
import { packStructuredPayload, unpackStructuredPayload } from '../utils/filePayload';
import { encryptData, decryptData } from '../crypto';
import { ImageMeta } from '../types';
import { Upload, Download, Copy, Check, Lock, Unlock, Image as ImageIcon, Sliders, RefreshCw, FileText, Paperclip, AlertCircle, Sparkles } from 'lucide-react';

export const ImageStegoSection: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'encode' | 'decode'>('encode');

  // ENCODE State
  const [coverImage, setCoverImage] = useState<HTMLImageElement | null>(null);
  const [imageMeta, setImageMeta] = useState<ImageMeta | null>(null);
  const [secretText, setSecretText] = useState('');
  const [secretFile, setSecretFile] = useState<{ name: string; bytes: Uint8Array } | null>(null);
  const [payloadType, setPayloadType] = useState<'text' | 'file'>('text');
  const [passphrase, setPassphrase] = useState('');
  const [bitsPerChannel, setBitsPerChannel] = useState<number>(1);
  const [isEncoding, setIsEncoding] = useState(false);
  const [encodedResultUrl, setEncodedResultUrl] = useState<string | null>(null);
  const [encodeError, setEncodeError] = useState<string | null>(null);

  // DECODE State
  const [stegoDecodeImage, setStegoDecodeImage] = useState<HTMLImageElement | null>(null);
  const [decodePassphrase, setDecodePassphrase] = useState('');
  const [isDecoding, setIsDecoding] = useState(false);
  const [decodedResultText, setDecodedResultText] = useState<string | null>(null);
  const [decodedFileResult, setDecodedFileResult] = useState<{ name: string; blobUrl: string } | null>(null);
  const [decodeError, setDecodeError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Generate synthetic sample cover images on canvas
  const createSampleCover = (type: 'art' | 'noise' | 'minimal') => {
    const canvas = document.createElement('canvas');
    canvas.width = 1000;
    canvas.height = 750;
    const ctx = canvas.getContext('2d')!;

    if (type === 'art') {
      const grad = ctx.createLinearGradient(0, 0, 1000, 750);
      grad.addColorStop(0, '#1a1c23');
      grad.addColorStop(0.5, '#2d2218');
      grad.addColorStop(1, '#0e1217');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1000, 750);

      // Geometric patterns
      for (let i = 0; i < 40; i++) {
        ctx.fillStyle = `rgba(${150 + i * 2}, ${120 + i}, ${80 + i * 3}, ${0.1 + (i % 5) * 0.05})`;
        ctx.beginPath();
        ctx.arc(Math.sin(i) * 500 + 500, Math.cos(i) * 350 + 375, 40 + i * 8, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (type === 'noise') {
      const imgData = ctx.createImageData(1000, 750);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const val = Math.floor(Math.random() * 255);
        data[i] = val;
        data[i + 1] = Math.floor(val * 0.8);
        data[i + 2] = Math.floor(val * 0.6);
        data[i + 3] = 255;
      }
      ctx.putImageData(imgData, 0, 0);
    } else {
      ctx.fillStyle = '#121417';
      ctx.fillRect(0, 0, 1000, 750);
      ctx.strokeStyle = '#24272c';
      ctx.lineWidth = 2;
      for (let x = 0; x < 1000; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 750); ctx.stroke();
      }
      for (let y = 0; y < 750; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1000, y); ctx.stroke();
      }
    }

    const img = new Image();
    img.src = canvas.toDataURL('image/png');
    img.onload = () => {
      setCoverImage(img);
      const totalPixels = 1000 * 750;
      const maxCap = calculateImageCapacity(1000, 750, bitsPerChannel);
      setImageMeta({
        width: 1000,
        height: 750,
        totalPixels,
        maxCapacityBytes: maxCap,
        name: `sample-${type}.png`,
        size: Math.round((totalPixels * 4) / 1024),
        type: 'image/png',
      });
      setEncodedResultUrl(null);
      setEncodeError(null);
    };
  };

  useEffect(() => {
    // Load default sample cover on initial mount
    createSampleCover('art');
  }, []);

  useEffect(() => {
    if (coverImage) {
      const maxCap = calculateImageCapacity(coverImage.width, coverImage.height, bitsPerChannel);
      setImageMeta((prev) => prev ? { ...prev, maxCapacityBytes: maxCap } : null);
    }
  }, [bitsPerChannel, coverImage]);

  // Handle Cover Image Upload
  const handleCoverUpload = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setEncodeError('Please select a valid image file (PNG, JPG, WEBP, etc.).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target?.result as string;
      img.onload = () => {
        setCoverImage(img);
        const maxCap = calculateImageCapacity(img.width, img.height, bitsPerChannel);
        setImageMeta({
          width: img.width,
          height: img.height,
          totalPixels: img.width * img.height,
          maxCapacityBytes: maxCap,
          name: file.name,
          size: Math.round(file.size / 1024),
          type: file.type,
        });
        setEncodedResultUrl(null);
        setEncodeError(null);
      };
    };
    reader.readAsDataURL(file);
  };

  // Handle Secret File Upload
  const handleSecretFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setSecretFile({
          name: file.name,
          bytes: new Uint8Array(e.target.result as ArrayBuffer),
        });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Execute LSB Steganographic Encoding
  const handleEncode = async () => {
    if (!coverImage) {
      setEncodeError('Please load or select a cover image first.');
      return;
    }

    let payloadBytes: Uint8Array;
    if (payloadType === 'text') {
      if (!secretText.trim()) {
        setEncodeError('Please enter a secret message to hide.');
        return;
      }
      payloadBytes = packStructuredPayload('text', { text: secretText });
    } else {
      if (!secretFile) {
        setEncodeError('Please attach a file to hide.');
        return;
      }
      payloadBytes = packStructuredPayload('file', {
        filename: secretFile.name,
        fileData: secretFile.bytes,
      });
    }

    setIsEncoding(true);
    setEncodeError(null);

    try {
      // 1. Encrypt payload with AES-256-GCM if passphrase provided
      const encryptedPayload = await encryptData(payloadBytes, passphrase);

      // 2. Prepare canvas ImageData
      const canvas = document.createElement('canvas');
      canvas.width = coverImage.width;
      canvas.height = coverImage.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(coverImage, 0, 0);

      const imgData = ctx.getImageData(0, 0, coverImage.width, coverImage.height);

      // 3. Embed encrypted payload into LSB
      const modifiedImgData = embedPayloadInImageData(imgData, encryptedPayload, bitsPerChannel);
      ctx.putImageData(modifiedImgData, 0, 0);

      // 4. Export as lossless PNG Data URL
      const dataUrl = canvas.toDataURL('image/png');
      setEncodedResultUrl(dataUrl);
    } catch (err: any) {
      console.error(err);
      setEncodeError(err.message || 'Failed to embed payload into image.');
    } finally {
      setIsEncoding(false);
    }
  };

  // Handle Stego Image Upload for DECODE
  const handleStegoDecodeUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target?.result as string;
      img.onload = () => {
        setStegoDecodeImage(img);
        setDecodedResultText(null);
        setDecodedFileResult(null);
        setDecodeError(null);
      };
    };
    reader.readAsDataURL(file);
  };

  // Execute LSB Steganographic Decoding
  const handleDecode = async () => {
    if (!stegoDecodeImage) {
      setDecodeError('Please select a stego PNG image to extract hidden data from.');
      return;
    }

    setIsDecoding(true);
    setDecodeError(null);

    try {
      const canvas = document.createElement('canvas');
      canvas.width = stegoDecodeImage.width;
      canvas.height = stegoDecodeImage.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(stegoDecodeImage, 0, 0);

      const imgData = ctx.getImageData(0, 0, stegoDecodeImage.width, stegoDecodeImage.height);

      // Extract raw bytes from LSB
      const extractedBytes = extractPayloadFromImageData(imgData, bitsPerChannel);

      // Decrypt using Web Crypto API
      const decryptedPayload = await decryptData(extractedBytes, decodePassphrase);

      // Unpack structured or legacy payload safely
      const unpacked = unpackStructuredPayload(decryptedPayload);

      if (unpacked.type === 'file' && unpacked.fileData && unpacked.filename) {
        const blob = new Blob([unpacked.fileData], { type: unpacked.mimeType || 'application/octet-stream' });
        const blobUrl = URL.createObjectURL(blob);
        setDecodedFileResult({ name: unpacked.filename, blobUrl });
        setDecodedResultText(`Secret File Recovered: "${unpacked.filename}" (${unpacked.fileData.length} bytes)`);
      } else {
        setDecodedResultText(unpacked.text || 'Payload contains no text representation.');
        setDecodedFileResult(null);
      }
    } catch (err: any) {
      console.error(err);
      setDecodeError(err.message || 'Decryption failed. Incorrect passphrase or image is unencoded.');
    } finally {
      setIsDecoding(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Payload size calculation accounting for structured packing + AES-256-GCM overhead
  const rawPayloadSize =
    payloadType === 'text'
      ? new TextEncoder().encode(secretText).length
      : secretFile
      ? secretFile.bytes.length
      : 0;

  const totalOverhead = (passphrase ? 44 : 0) + (payloadType === 'text' ? 6 : (secretFile ? 20 : 0));
  const currentPayloadSize = rawPayloadSize > 0 ? rawPayloadSize + totalOverhead : 0;

  const capacityPct = imageMeta
    ? Math.min(100, Math.round((currentPayloadSize / imageMeta.maxCapacityBytes) * 100))
    : 0;

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
            <span>ENCODE HIDDEN DATA</span>
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
          LSB SPATIAL DOMAIN EMBEDDING
        </div>
      </div>

      {/* ENCODE PANEL */}
      {activeTab === 'encode' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Input Form */}
          <div className="lg:col-span-7 space-y-6">
            {/* Cover Image Upload Area */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-mono-custom tracking-wider text-[#93979e] uppercase">
                  1. Select Cover Image
                </label>
                <div className="flex space-x-1">
                  <button
                    onClick={() => createSampleCover('art')}
                    className="text-[10px] font-mono-custom px-2 py-0.5 rounded bg-[#16181c] border border-[#24272c] text-[#c9a876] hover:border-[#c9a876]"
                  >
                    Sample Art
                  </button>
                  <button
                    onClick={() => createSampleCover('noise')}
                    className="text-[10px] font-mono-custom px-2 py-0.5 rounded bg-[#16181c] border border-[#24272c] text-[#93979e] hover:border-[#c9a876]"
                  >
                    Sample Noise
                  </button>
                </div>
              </div>

              <div className="relative border border-dashed border-[#383c42] rounded-md bg-[#0f1114] p-6 text-center hover:border-[#c9a876] transition-colors group cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files?.[0] && handleCoverUpload(e.target.files[0])}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <ImageIcon className="w-8 h-8 mx-auto text-[#53575d] group-hover:text-[#c9a876] transition-colors" />
                <p className="mt-2 text-xs font-mono-custom text-[#ece8e0]">
                  DRAG & DROP IMAGE OR CLICK TO BROWSE
                </p>
                <p className="text-[11px] text-[#93979e] mt-1">PNG, JPG, WEBP (Converted losslessly to PNG carrier)</p>
              </div>

              {/* Cover Image Meta Info */}
              {imageMeta && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-[#121417] p-3 rounded border border-[#24272c] text-xs font-mono-custom">
                  <div>
                    <span className="text-[10px] text-[#53575d] block">DIMENSIONS</span>
                    <span className="text-[#ece8e0]">{imageMeta.width} × {imageMeta.height} px</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#53575d] block">PIXELS</span>
                    <span className="text-[#ece8e0]">{(imageMeta.totalPixels / 1000000).toFixed(2)} MP</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#53575d] block">MAX CAPACITY</span>
                    <span className="text-[#8fae82] font-semibold">{(imageMeta.maxCapacityBytes / 1024).toFixed(1)} KB</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#53575d] block">FORMAT</span>
                    <span className="text-[#c9a876]">PNG LOSSLESS</span>
                  </div>
                </div>
              )}
            </div>

            {/* Secret Payload Input */}
            <div className="space-y-3 bg-[#121417] p-4 rounded border border-[#24272c]">
              <div className="flex items-center justify-between">
                <label className="text-xs font-mono-custom tracking-wider text-[#93979e] uppercase">
                  2. Secret Payload
                </label>
                <div className="flex items-center space-x-1 bg-[#0f1114] p-0.5 rounded border border-[#24272c]">
                  <button
                    onClick={() => setPayloadType('text')}
                    className={`flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-mono-custom ${
                      payloadType === 'text' ? 'bg-[#c9a876] text-[#0b0c0e] font-semibold' : 'text-[#93979e]'
                    }`}
                  >
                    <FileText className="w-3 h-3" />
                    <span>TEXT</span>
                  </button>
                  <button
                    onClick={() => setPayloadType('file')}
                    className={`flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-mono-custom ${
                      payloadType === 'file' ? 'bg-[#c9a876] text-[#0b0c0e] font-semibold' : 'text-[#93979e]'
                    }`}
                  >
                    <Paperclip className="w-3 h-3" />
                    <span>FILE ATTACHMENT</span>
                  </button>
                </div>
              </div>

              {payloadType === 'text' ? (
                <textarea
                  value={secretText}
                  onChange={(e) => setSecretText(e.target.value)}
                  placeholder="Write the confidential message to hide inside the image pixels..."
                  rows={4}
                  className="w-full bg-[#16181c] border border-[#24272c] focus:border-[#c9a876] rounded p-3 text-xs font-mono-custom text-[#ece8e0] placeholder-[#53575d] focus:outline-none"
                />
              ) : (
                <div className="border border-dashed border-[#383c42] rounded p-4 text-center bg-[#16181c]">
                  <input
                    type="file"
                    onChange={(e) => e.target.files?.[0] && handleSecretFileUpload(e.target.files[0])}
                    className="hidden"
                    id="secret-file-input"
                  />
                  <label htmlFor="secret-file-input" className="cursor-pointer space-y-1 block">
                    <Paperclip className="w-6 h-6 mx-auto text-[#c9a876]" />
                    <span className="text-xs font-mono-custom text-[#ece8e0] block">
                      {secretFile ? secretFile.name : 'CLICK TO ATTACH SECRET FILE (PDF, CODE, ZIP, KEYS)'}
                    </span>
                    {secretFile && (
                      <span className="text-[10px] font-mono-custom text-[#8fae82] block">
                        {(secretFile.bytes.length / 1024).toFixed(2)} KB
                      </span>
                    )}
                  </label>
                </div>
              )}

              {/* Payload Capacity Bar */}
              {imageMeta && (
                <div className="space-y-1 pt-1">
                  <div className="flex justify-between text-[10px] font-mono-custom">
                    <span className="text-[#93979e]">
                      Payload Size: {currentPayloadSize} Bytes
                    </span>
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

            {/* Passphrase & LSB Tuning */}
            <div className="space-y-4 bg-[#121417] p-4 rounded border border-[#24272c]">
              <PasswordStrengthMeter
                value={passphrase}
                onChange={setPassphrase}
                label="3. AES-256 Passphrase (Optional but Recommended)"
                placeholder="Passphrase encrypts data before embedding into LSB..."
              />

              {/* LSB Channel Tuning Slider */}
              <div className="pt-2 border-t border-[#24272c]">
                <div className="flex items-center justify-between text-xs font-mono-custom text-[#93979e] mb-2">
                  <span className="flex items-center space-x-1">
                    <Sliders className="w-3.5 h-3.5 text-[#c9a876]" />
                    <span>LSB Bits Per RGB Channel: {bitsPerChannel} bit{bitsPerChannel > 1 ? 's' : ''}</span>
                  </span>
                  <span className="text-[10px] text-[#53575d]">
                    {bitsPerChannel === 1 ? 'Lowest Visual Distortion (0.4% delta)' : 'Higher Capacity'}
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={4}
                  value={bitsPerChannel}
                  onChange={(e) => setBitsPerChannel(parseInt(e.target.value))}
                  className="w-full accent-[#c9a876] cursor-pointer"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <button
              onClick={handleEncode}
              disabled={isEncoding || !coverImage}
              className="w-full py-3.5 px-4 rounded bg-[#c9a876] hover:bg-[#a58c62] disabled:opacity-40 text-[#0b0c0e] font-mono-custom font-bold text-xs tracking-widest uppercase transition-all flex items-center justify-center space-x-2 shadow-lg cursor-pointer"
            >
              {isEncoding ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>EMBEDDING PAYLOAD & GENERATING STEGO PNG...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>EMBED PAYLOAD & CREATE STEGO IMAGE</span>
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

          {/* Right Column: Previews & Download */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-[#121417] p-4 rounded border border-[#24272c] space-y-4">
              <h3 className="text-xs font-mono-custom tracking-wider text-[#ece8e0] uppercase flex items-center space-x-2">
                <ImageIcon className="w-4 h-4 text-[#c9a876]" />
                <span>Cover Image Preview</span>
              </h3>

              <div className="aspect-video bg-[#000000] rounded overflow-hidden border border-[#24272c] flex items-center justify-center">
                {coverImage ? (
                  <img src={coverImage.src} alt="Cover" className="w-full h-full object-contain" />
                ) : (
                  <div className="text-xs font-mono-custom text-[#53575d]">No cover image loaded</div>
                )}
              </div>
            </div>

            {/* Stego Result PNG */}
            {encodedResultUrl && (
              <div className="bg-[#121417] p-4 rounded border border-[#8fae82]/50 space-y-4 animate-fade-in">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-mono-custom tracking-wider text-[#8fae82] uppercase flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-[#8fae82]" />
                    <span>Stego PNG Output Ready</span>
                  </h3>
                  <span className="text-[10px] font-mono-custom px-2 py-0.5 rounded bg-[#8fae82]/10 text-[#8fae82]">
                    LOSSLESS
                  </span>
                </div>

                <div className="aspect-video bg-[#000000] rounded overflow-hidden border border-[#8fae82]/30 flex items-center justify-center">
                  <img src={encodedResultUrl} alt="Stego Output" className="w-full h-full object-contain" />
                </div>

                <a
                  href={encodedResultUrl}
                  download={`stego-vault-${Date.now()}.png`}
                  className="w-full py-3 px-4 rounded bg-[#8fae82] hover:bg-[#739266] text-[#0b0c0e] font-mono-custom font-bold text-xs tracking-widest uppercase transition-all flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>DOWNLOAD STEGO PNG</span>
                </a>

                <p className="text-[11px] text-[#93979e] leading-normal font-mono-custom">
                  Keep this PNG file intact. Do not upload to platforms that apply lossy JPEG compression (e.g. WhatsApp / Twitter), as compression alters pixel LSBs. Share via Email, Signal, or Drive as an uncompressed document.
                </p>
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
                1. Select Stego Image (PNG)
              </label>

              <div className="relative border border-dashed border-[#383c42] rounded-md bg-[#0f1114] p-6 text-center hover:border-[#c9a876] transition-colors group cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files?.[0] && handleStegoDecodeUpload(e.target.files[0])}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <ImageIcon className="w-8 h-8 mx-auto text-[#53575d] group-hover:text-[#c9a876] transition-colors" />
                <p className="mt-2 text-xs font-mono-custom text-[#ece8e0]">
                  DRAG & DROP STEGO PNG OR CLICK TO BROWSE
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

              <div className="flex items-center justify-between text-xs font-mono-custom text-[#93979e] pt-2 border-t border-[#24272c]">
                <span>LSB Bit Depth: {bitsPerChannel} bit</span>
                <input
                  type="range"
                  min={1}
                  max={4}
                  value={bitsPerChannel}
                  onChange={(e) => setBitsPerChannel(parseInt(e.target.value))}
                  className="w-32 accent-[#c9a876] cursor-pointer"
                />
              </div>
            </div>

            <button
              onClick={handleDecode}
              disabled={isDecoding || !stegoDecodeImage}
              className="w-full py-3.5 px-4 rounded bg-[#c9a876] hover:bg-[#a58c62] disabled:opacity-40 text-[#0b0c0e] font-mono-custom font-bold text-xs tracking-widest uppercase transition-all flex items-center justify-center space-x-2 cursor-pointer"
            >
              {isDecoding ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>EXTRACTING & DECRYPTING LSB PAYLOAD...</span>
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

          {/* Right Column: Decoded Output */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-[#121417] p-4 rounded border border-[#24272c] space-y-4">
              <h3 className="text-xs font-mono-custom tracking-wider text-[#ece8e0] uppercase flex items-center space-x-2">
                <Unlock className="w-4 h-4 text-[#8fae82]" />
                <span>Recovered Plaintext / File</span>
              </h3>

              {decodedResultText ? (
                <div className="space-y-3">
                  <textarea
                    readOnly
                    value={decodedResultText}
                    rows={8}
                    className="w-full bg-[#0f1114] border border-[#24272c] rounded p-3 text-xs font-mono-custom text-[#8fae82] focus:outline-none"
                  />
                  <div className="flex space-x-2">
                    <button
                      onClick={() => copyToClipboard(decodedResultText)}
                      className="flex-1 py-2 px-3 rounded bg-[#16181c] border border-[#24272c] hover:border-[#c9a876] text-xs font-mono-custom text-[#ece8e0] flex items-center justify-center space-x-2"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-[#8fae82]" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'COPIED!' : 'COPY MESSAGE'}</span>
                    </button>

                    {decodedFileResult && (
                      <a
                        href={decodedFileResult.blobUrl}
                        download={decodedFileResult.name}
                        className="py-2 px-4 rounded bg-[#8fae82] text-[#0b0c0e] font-mono-custom text-xs font-bold flex items-center space-x-2"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>DOWNLOAD FILE</span>
                      </a>
                    )}
                  </div>
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
