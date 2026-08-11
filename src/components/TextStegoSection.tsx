import React, { useState } from 'react';
import {
  embedZeroWidthInText,
  extractZeroWidthFromText,
  inspectTextSteganography,
  highlightInvisibleChars,
  COVER_PRESETS,
} from '../utils/textStego';
import { encryptTextToBase64, decryptTextFromBase64 } from '../crypto';
import { PasswordStrengthMeter } from './PasswordStrengthMeter';
import { FileText, Lock, Unlock, Copy, Check, Eye, AlertCircle, Sparkles, RefreshCw, Download } from 'lucide-react';

export const TextStegoSection: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'encode' | 'decode' | 'inspect'>('encode');

  // ENCODE State
  const [secretMessage, setSecretMessage] = useState('');
  const [coverText, setCoverText] = useState(COVER_PRESETS[0].text);
  const [passphrase, setPassphrase] = useState('');
  const [isEncoding, setIsEncoding] = useState(false);
  const [stegoTextOutput, setStegoTextOutput] = useState<string | null>(null);
  const [encodeError, setEncodeError] = useState<string | null>(null);

  // DECODE State
  const [stegoInput, setStegoInput] = useState('');
  const [decodePassphrase, setDecodePassphrase] = useState('');
  const [isDecoding, setIsDecoding] = useState(false);
  const [decodedOutput, setDecodedOutput] = useState<string | null>(null);
  const [decodeError, setDecodeError] = useState<string | null>(null);

  // INSPECT State
  const [inspectInput, setInspectInput] = useState('');

  const [copied, setCopied] = useState(false);

  // Execute Zero-Width Steganographic Encoding
  const handleEncode = async () => {
    if (!secretMessage.trim()) {
      setEncodeError('Please enter a secret message to hide.');
      return;
    }

    if (!coverText.trim()) {
      setEncodeError('Please enter or select a cover text to embed the hidden message into.');
      return;
    }

    setIsEncoding(true);
    setEncodeError(null);

    try {
      // 1. Encrypt secret payload if passphrase supplied or encode to Base64
      let payloadBytes: Uint8Array;
      if (passphrase.trim()) {
        const encryptedB64 = await encryptTextToBase64(secretMessage, passphrase);
        payloadBytes = new TextEncoder().encode(encryptedB64);
      } else {
        payloadBytes = new TextEncoder().encode(secretMessage);
      }

      // 2. Embed into zero-width characters inside cover text
      const stegoResult = embedZeroWidthInText(coverText, payloadBytes);
      setStegoTextOutput(stegoResult);
    } catch (err: any) {
      console.error(err);
      setEncodeError(err.message || 'Failed to encode text steganography.');
    } finally {
      setIsEncoding(false);
    }
  };

  // Execute Zero-Width Steganographic Decoding
  const handleDecode = async () => {
    if (!stegoInput.trim()) {
      setDecodeError('Please paste stego text containing hidden zero-width characters.');
      return;
    }

    setIsDecoding(true);
    setDecodeError(null);

    try {
      // 1. Extract zero-width bytes
      const extractedBytes = extractZeroWidthFromText(stegoInput);
      const extractedStr = new TextDecoder('utf-8').decode(extractedBytes);

      // 2. Decrypt if passphrase provided or if ciphertext
      if (decodePassphrase.trim()) {
        const decrypted = await decryptTextFromBase64(extractedStr, decodePassphrase);
        setDecodedOutput(decrypted);
      } else {
        // Try direct decrypt or fallback
        try {
          const decrypted = await decryptTextFromBase64(extractedStr, '');
          setDecodedOutput(decrypted);
        } catch {
          setDecodedOutput(extractedStr);
        }
      }
    } catch (err: any) {
      console.error(err);
      setDecodeError(err.message || 'Failed to extract hidden message. Text may not contain zero-width payload or passphrase is wrong.');
    } finally {
      setIsDecoding(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Inspection stats
  const inspectStats = inspectTextSteganography(inspectInput || stegoTextOutput || '');
  const highlighted = highlightInvisibleChars(inspectInput || stegoTextOutput || '');

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
            <span>ENCODE ZERO-WIDTH</span>
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
          <button
            onClick={() => setActiveTab('inspect')}
            className={`flex items-center space-x-2 px-4 py-2 rounded font-mono-custom text-xs tracking-wider transition-colors ${
              activeTab === 'inspect'
                ? 'bg-[#c9a876] text-[#0b0c0e] font-semibold'
                : 'text-[#93979e] hover:text-[#ece8e0] bg-[#121417]'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>VISUAL REVEALER</span>
          </button>
        </div>

        <div className="text-xs font-mono-custom text-[#93979e] hidden sm:block">
          INVISIBLE UNICODE INJECTION
        </div>
      </div>

      {/* ENCODE PANEL */}
      {activeTab === 'encode' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 space-y-6">
            {/* Secret Message */}
            <div className="space-y-2 bg-[#121417] p-4 rounded border border-[#24272c]">
              <label className="block text-xs font-mono-custom tracking-wider text-[#93979e] uppercase">
                1. Secret Message To Hide
              </label>
              <textarea
                value={secretMessage}
                onChange={(e) => setSecretMessage(e.target.value)}
                placeholder="Type confidential message..."
                rows={3}
                className="w-full bg-[#16181c] border border-[#24272c] focus:border-[#c9a876] rounded p-3 text-xs font-mono-custom text-[#ece8e0] focus:outline-none"
              />
            </div>

            {/* Cover Text Selection */}
            <div className="space-y-3 bg-[#121417] p-4 rounded border border-[#24272c]">
              <div className="flex items-center justify-between">
                <label className="text-xs font-mono-custom tracking-wider text-[#93979e] uppercase">
                  2. Public Cover Text Carrier
                </label>
                <span className="text-[10px] font-mono-custom text-[#53575d]">Select preset or paste custom</span>
              </div>

              <div className="flex flex-wrap gap-2">
                {COVER_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCoverText(preset.text)}
                    className="text-[10px] font-mono-custom px-2.5 py-1 rounded bg-[#16181c] border border-[#24272c] text-[#c9a876] hover:border-[#c9a876]"
                  >
                    {preset.title}
                  </button>
                ))}
              </div>

              <textarea
                value={coverText}
                onChange={(e) => setCoverText(e.target.value)}
                rows={5}
                className="w-full bg-[#16181c] border border-[#24272c] focus:border-[#c9a876] rounded p-3 text-xs font-mono-custom text-[#ece8e0] focus:outline-none"
              />
            </div>

            {/* Passphrase */}
            <div className="bg-[#121417] p-4 rounded border border-[#24272c]">
              <PasswordStrengthMeter
                value={passphrase}
                onChange={setPassphrase}
                label="3. Encryption Passphrase (Optional)"
                placeholder="Encrypts secret message before unicode zero-width injection..."
              />
            </div>

            <button
              onClick={handleEncode}
              disabled={isEncoding}
              className="w-full py-3.5 px-4 rounded bg-[#c9a876] hover:bg-[#a58c62] text-[#0b0c0e] font-mono-custom font-bold text-xs tracking-widest uppercase transition-all flex items-center justify-center space-x-2 cursor-pointer"
            >
              {isEncoding ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>INJECTING ZERO-WIDTH UNICODE...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>GENERATE STEGO TEXT</span>
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

          {/* Right Column: Output */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-[#121417] p-4 rounded border border-[#24272c] space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-mono-custom tracking-wider text-[#ece8e0] uppercase flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-[#c9a876]" />
                  <span>Stego Text Output</span>
                </h3>
                {stegoTextOutput && (
                  <span className="text-[10px] font-mono-custom px-2 py-0.5 rounded bg-[#8fae82]/10 text-[#8fae82]">
                    CONTAINS INVISIBLE PAYLOAD
                  </span>
                )}
              </div>

              {stegoTextOutput ? (
                <div className="space-y-3">
                  <textarea
                    readOnly
                    value={stegoTextOutput}
                    rows={10}
                    className="w-full bg-[#0f1114] border border-[#24272c] rounded p-3 text-xs font-mono-custom text-[#ece8e0] focus:outline-none"
                  />
                  <div className="flex space-x-2">
                    <button
                      onClick={() => copyToClipboard(stegoTextOutput)}
                      className="flex-1 py-2.5 px-3 rounded bg-[#c9a876] hover:bg-[#a58c62] text-[#0b0c0e] font-mono-custom text-xs font-bold flex items-center justify-center space-x-2 cursor-pointer"
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      <span>{copied ? 'COPIED TO CLIPBOARD!' : 'COPY STEGO TEXT'}</span>
                    </button>
                    <button
                      onClick={() => {
                        setInspectInput(stegoTextOutput);
                        setActiveTab('inspect');
                      }}
                      className="py-2.5 px-3 rounded bg-[#16181c] border border-[#24272c] hover:border-[#c9a876] text-xs font-mono-custom text-[#c9a876] flex items-center space-x-1"
                      title="View in Visual Revealer"
                    >
                      <Eye className="w-4 h-4" />
                      <span>REVEAL</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-[#93979e] font-mono-custom leading-relaxed">
                    This text looks completely ordinary when posted to Twitter, Email, Slack, or Docs, but carries the hidden payload as invisible Unicode characters.
                  </p>
                </div>
              ) : (
                <div className="h-64 rounded bg-[#0f1114] border border-[#24272c] flex items-center justify-center text-xs font-mono-custom text-[#53575d]">
                  Generated stego text will appear here
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* DECODE PANEL */}
      {activeTab === 'decode' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 space-y-6">
            <div className="space-y-2 bg-[#121417] p-4 rounded border border-[#24272c]">
              <label className="block text-xs font-mono-custom tracking-wider text-[#93979e] uppercase">
                1. Paste Stego Text
              </label>
              <textarea
                value={stegoInput}
                onChange={(e) => setStegoInput(e.target.value)}
                placeholder="Paste text containing hidden zero-width unicode payload..."
                rows={6}
                className="w-full bg-[#16181c] border border-[#24272c] focus:border-[#c9a876] rounded p-3 text-xs font-mono-custom text-[#ece8e0] focus:outline-none"
              />
            </div>

            <div className="bg-[#121417] p-4 rounded border border-[#24272c]">
              <PasswordStrengthMeter
                value={decodePassphrase}
                onChange={setDecodePassphrase}
                label="2. Decryption Passphrase (If encrypted)"
                placeholder="Enter passphrase used during encoding..."
                showStrength={false}
              />
            </div>

            <button
              onClick={handleDecode}
              disabled={isDecoding}
              className="w-full py-3.5 px-4 rounded bg-[#c9a876] hover:bg-[#a58c62] text-[#0b0c0e] font-mono-custom font-bold text-xs tracking-widest uppercase transition-all flex items-center justify-center space-x-2 cursor-pointer"
            >
              {isDecoding ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>EXTRACTING ZERO-WIDTH UNICODE...</span>
                </>
              ) : (
                <>
                  <Unlock className="w-4 h-4" />
                  <span>EXTRACT SECRET MESSAGE</span>
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

          <div className="lg:col-span-5 space-y-6">
            <div className="bg-[#121417] p-4 rounded border border-[#24272c] space-y-4">
              <h3 className="text-xs font-mono-custom tracking-wider text-[#ece8e0] uppercase flex items-center space-x-2">
                <Unlock className="w-4 h-4 text-[#8fae82]" />
                <span>Extracted Secret Message</span>
              </h3>

              {decodedOutput ? (
                <div className="space-y-3">
                  <textarea
                    readOnly
                    value={decodedOutput}
                    rows={8}
                    className="w-full bg-[#0f1114] border border-[#24272c] rounded p-3 text-xs font-mono-custom text-[#8fae82] focus:outline-none"
                  />
                  <button
                    onClick={() => copyToClipboard(decodedOutput)}
                    className="w-full py-2 px-3 rounded bg-[#16181c] border border-[#24272c] hover:border-[#c9a876] text-xs font-mono-custom text-[#ece8e0] flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-[#8fae82]" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'COPIED!' : 'COPY RECOVERED MESSAGE'}</span>
                  </button>
                </div>
              ) : (
                <div className="h-48 rounded bg-[#0f1114] border border-[#24272c] flex items-center justify-center text-xs font-mono-custom text-[#53575d]">
                  Extracted message output will appear here
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* INSPECT VISUAL REVEALER PANEL */}
      {activeTab === 'inspect' && (
        <div className="space-y-6">
          <div className="bg-[#121417] p-4 rounded border border-[#24272c] space-y-3">
            <label className="block text-xs font-mono-custom tracking-wider text-[#93979e] uppercase">
              Inspect Text For Invisible Zero-Width Characters
            </label>
            <textarea
              value={inspectInput}
              onChange={(e) => setInspectInput(e.target.value)}
              placeholder="Paste any suspicious text to reveal invisible hidden characters..."
              rows={4}
              className="w-full bg-[#16181c] border border-[#24272c] focus:border-[#c9a876] rounded p-3 text-xs font-mono-custom text-[#ece8e0] focus:outline-none"
            />
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#121417] p-3 rounded border border-[#24272c]">
              <span className="text-[10px] font-mono-custom text-[#53575d] block">TOTAL CHARACTERS</span>
              <span className="font-mono-custom text-sm font-semibold text-[#ece8e0]">{inspectStats.totalChars}</span>
            </div>
            <div className="bg-[#121417] p-3 rounded border border-[#24272c]">
              <span className="text-[10px] font-mono-custom text-[#53575d] block">VISIBLE CHARS</span>
              <span className="font-mono-custom text-sm font-semibold text-[#ece8e0]">{inspectStats.visibleChars}</span>
            </div>
            <div className="bg-[#121417] p-3 rounded border border-[#24272c]">
              <span className="text-[10px] font-mono-custom text-[#53575d] block">HIDDEN ZERO-WIDTH</span>
              <span className="font-mono-custom text-sm font-semibold text-[#c9a876]">{inspectStats.hiddenZwChars}</span>
            </div>
            <div className="bg-[#121417] p-3 rounded border border-[#24272c]">
              <span className="text-[10px] font-mono-custom text-[#53575d] block">ESTIMATED PAYLOAD</span>
              <span className="font-mono-custom text-sm font-semibold text-[#8fae82]">{inspectStats.estimatedPayloadBytes} Bytes</span>
            </div>
          </div>

          {/* Character-by-character visual rendering */}
          <div className="bg-[#121417] p-4 rounded border border-[#24272c] space-y-3">
            <h3 className="text-xs font-mono-custom tracking-wider text-[#ece8e0] uppercase flex items-center space-x-2">
              <Eye className="w-4 h-4 text-[#c9a876]" />
              <span>Visual Character Inspector Rendering</span>
            </h3>

            <div
              dangerouslySetInnerHTML={{ __html: highlighted.html || 'No input provided.' }}
              className="bg-[#0f1114] border border-[#24272c] rounded p-4 text-xs font-mono-custom text-[#ece8e0] leading-relaxed break-words min-h-[120px]"
            />
          </div>
        </div>
      )}
    </div>
  );
};
