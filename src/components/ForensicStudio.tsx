import React, { useState, useRef, useEffect } from 'react';
import { renderBitplane, analyzeImageSteganography, generateDifferenceHeatmap } from '../utils/imageStego';
import { ForensicResult } from '../types';
import { Eye, ShieldAlert, ShieldCheck, Upload, Layers, Sliders, RefreshCw, BarChart2 } from 'lucide-react';

export const ForensicStudio: React.FC = () => {
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);
  const [isDemoSample, setIsDemoSample] = useState(true);
  const [bitIndex, setBitIndex] = useState<number>(0); // 0 (LSB) to 7 (MSB)
  const [channel, setChannel] = useState<'all' | 'red' | 'green' | 'blue' | 'alpha' | 'luminance'>('all');
  const [forensicResult, setForensicResult] = useState<ForensicResult | null>(null);
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [isAnalyzingAi, setIsAnalyzingAi] = useState(false);

  const bitplaneCanvasRef = useRef<HTMLCanvasElement>(null);

  // Generate default synthetic test image on mount
  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 400;
    const ctx = canvas.getContext('2d')!;

    const grad = ctx.createRadialGradient(300, 200, 10, 300, 200, 300);
    grad.addColorStop(0, '#3a2d21');
    grad.addColorStop(0.5, '#1e241c');
    grad.addColorStop(1, '#0e1014');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 600, 400);

    // Add noise in LSB to demonstrate stego detection
    const imgData = ctx.getImageData(0, 0, 600, 400);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      if (Math.random() > 0.4) {
        data[i] = data[i] ^ 1; // flip LSB
      }
    }
    ctx.putImageData(imgData, 0, 0);

    const img = new Image();
    img.src = canvas.toDataURL('image/png');
    img.onload = () => setSourceImage(img);
  }, []);

  // Update Bitplane Canvas & Chi-Square Analysis when image or bit/channel changes
  useEffect(() => {
    if (!sourceImage || !bitplaneCanvasRef.current) return;

    const canvas = document.createElement('canvas');
    canvas.width = sourceImage.width;
    canvas.height = sourceImage.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(sourceImage, 0, 0);

    const srcData = ctx.getImageData(0, 0, sourceImage.width, sourceImage.height);

    // Render Bitplane
    const bitplaneData = renderBitplane(srcData, bitIndex, channel);

    const targetCanvas = bitplaneCanvasRef.current;
    targetCanvas.width = sourceImage.width;
    targetCanvas.height = sourceImage.height;
    const targetCtx = targetCanvas.getContext('2d')!;
    targetCtx.putImageData(bitplaneData, 0, 0);

    // Run Forensic Chi-Square Test
    const results = analyzeImageSteganography(srcData);
    setForensicResult(results);
  }, [sourceImage, bitIndex, channel]);

  // Handle Custom Upload
  const handleImageUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target?.result as string;
      img.onload = () => {
        setSourceImage(img);
        setIsDemoSample(false);
        setAiReport(null);
      };
    };
    reader.readAsDataURL(file);
  };

  const handleAiForensicConsult = async () => {
    if (!forensicResult) return;
    setIsAnalyzingAi(true);
    setAiReport(null);

    try {
      const res = await fetch('/api/ai/analyze-stego', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'image-lsb',
          payloadSize: 'Unknown (Passive Scan)',
          chiSquarePValue: forensicResult.chiSquarePValue,
          lsbNoiseRatio: forensicResult.lsbNoiseRatio,
          entropy: forensicResult.entropy,
        }),
      });

      const data = await res.json();
      if (data.success && data.analysis) {
        setAiReport(data.analysis);
      } else {
        setAiReport('Failed to generate AI report.');
      }
    } catch (err) {
      console.error(err);
      setAiReport('### AI Forensic Assessment\n- **LSB Noise Ratio**: ' + (forensicResult.lsbNoiseRatio * 100).toFixed(2) + '%\n- **Statistical Verdict**: ' + forensicResult.verdict + '\n- **Stealth Evaluation**: Statistical chi-square p-value is ' + forensicResult.chiSquarePValue.toFixed(4) + '. Payload exhibits ' + (forensicResult.suspicionScore > 50 ? 'suspicious LSB uniformity' : 'normal natural photo noise variance') + '.');
    } finally {
      setIsAnalyzingAi(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-[#24272c] pb-3 flex items-center justify-between">
        <div>
          <h2 className="font-serif-custom text-2xl italic font-normal text-[#ece8e0] flex items-center gap-2">
            <Eye className="w-5 h-5 text-[#c9a876]" />
            <span>Steganalysis & Bitplane Inspector</span>
          </h2>
          <p className="text-xs font-mono-custom text-[#93979e] mt-1">
            Deconstruct image pixel bitplanes (Bit 0 LSB to Bit 7 MSB) to reveal hidden noise, secret watermarks, or LSB steganography.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Controls & Image Upload */}
        <div className="lg:col-span-5 space-y-6">
          {/* Upload Box */}
          <div className="relative border border-dashed border-[#383c42] rounded-md bg-[#0f1114] p-6 text-center hover:border-[#c9a876] transition-colors group cursor-pointer">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <Upload className="w-8 h-8 mx-auto text-[#53575d] group-hover:text-[#c9a876] transition-colors" />
            <p className="mt-2 text-xs font-mono-custom text-[#ece8e0]">
              UPLOAD SUSPECT IMAGE FOR FORENSIC ANALYSIS
            </p>
          </div>

          {/* Bitplane Selector Controls */}
          <div className="space-y-4 bg-[#121417] p-4 rounded border border-[#24272c]">
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-mono-custom text-[#93979e]">
                <span>SELECT BITPLANE: BIT {bitIndex} {bitIndex === 0 ? '(LSB - Hidden Data)' : bitIndex === 7 ? '(MSB - High Contrast)' : ''}</span>
                <span className="text-[#c9a876]">BIT {bitIndex}</span>
              </div>

              {/* Bit Buttons Grid 0 to 7 */}
              <div className="grid grid-cols-8 gap-1">
                {[0, 1, 2, 3, 4, 5, 6, 7].map((b) => (
                  <button
                    key={b}
                    onClick={() => setBitIndex(b)}
                    className={`py-2 rounded font-mono-custom text-xs font-bold transition-all cursor-pointer ${
                      bitIndex === b
                        ? 'bg-[#c9a876] text-[#0b0c0e]'
                        : 'bg-[#16181c] border border-[#24272c] text-[#93979e] hover:text-[#ece8e0]'
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>

            {/* Channel Selection */}
            <div className="space-y-2">
              <label className="block text-xs font-mono-custom text-[#93979e] uppercase">
                Color Channel Isolation
              </label>
              <div className="grid grid-cols-3 gap-1.5 font-mono-custom text-xs">
                {(['all', 'red', 'green', 'blue', 'alpha', 'luminance'] as const).map((ch) => (
                  <button
                    key={ch}
                    onClick={() => setChannel(ch)}
                    className={`py-1.5 px-2 rounded capitalize transition-colors cursor-pointer ${
                      channel === ch
                        ? 'bg-[#c9a876] text-[#0b0c0e] font-bold'
                        : 'bg-[#16181c] border border-[#24272c] text-[#93979e] hover:text-[#ece8e0]'
                    }`}
                  >
                    {ch}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Chi-Square Statistical Verdict Card */}
          {forensicResult && (
            <div
              className={`p-4 rounded border space-y-3 ${
                forensicResult.verdict === 'high_statistical_anomaly'
                  ? 'bg-[#c47461]/10 border-[#c47461]/40 text-[#c47461]'
                  : forensicResult.verdict === 'suspicious'
                  ? 'bg-[#c9a876]/10 border-[#c9a876]/40 text-[#c9a876]'
                  : 'bg-[#8fae82]/10 border-[#8fae82]/40 text-[#8fae82]'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 font-mono-custom text-xs font-bold uppercase">
                  {forensicResult.verdict === 'high_statistical_anomaly' ? (
                    <ShieldAlert className="w-4 h-4 text-[#c47461]" />
                  ) : (
                    <ShieldCheck className="w-4 h-4 text-[#8fae82]" />
                  )}
                  <span>VERDICT: {forensicResult.verdict === 'high_statistical_anomaly' ? 'PROBABLE LSB ANOMALY DETECTED' : forensicResult.verdict === 'suspicious' ? 'MODERATE STATISTICAL ANOMALY' : 'NATURAL NOISE PROFILE'}</span>
                </div>
                <span className="font-mono-custom text-xs font-bold">
                  {forensicResult.suspicionScore}% SUSPICION
                </span>
              </div>

              <p className="text-xs font-mono-custom text-[#ece8e0]/90 leading-relaxed">
                {forensicResult.details}
              </p>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-current/20 text-[11px] font-mono-custom">
                <div>
                  <span className="block opacity-70">LSB NOISE RATIO</span>
                  <span className="font-semibold">{(forensicResult.lsbNoiseRatio * 100).toFixed(2)}%</span>
                </div>
                <div>
                  <span className="block opacity-70">CHI-SQUARE P-VALUE</span>
                  <span className="font-semibold">{forensicResult.chiSquarePValue.toFixed(4)}</span>
                </div>
              </div>

              <button
                onClick={handleAiForensicConsult}
                disabled={isAnalyzingAi}
                className="w-full mt-2 py-2 px-3 rounded bg-[#16181c] border border-current hover:bg-[#c9a876] hover:text-[#0b0c0e] text-xs font-mono-custom font-bold flex items-center justify-center space-x-2 transition-colors cursor-pointer"
              >
                {isAnalyzingAi ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>CONSULTING AI FORENSIC ADVISOR...</span>
                  </>
                ) : (
                  <>
                    <BarChart2 className="w-3.5 h-3.5" />
                    <span>AI FORENSIC CONSULTATION REPORT</span>
                  </>
                )}
              </button>

              {aiReport && (
                <div className="p-3 mt-2 rounded bg-[#0b0c0e] border border-[#24272c] text-[11px] font-mono-custom text-[#ece8e0] leading-relaxed whitespace-pre-wrap">
                  {aiReport}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Bitplane Visual Canvas Display */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-[#121417] p-4 rounded border border-[#24272c] space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono-custom tracking-wider text-[#ece8e0] uppercase flex items-center space-x-2">
                <Layers className="w-4 h-4 text-[#c9a876]" />
                <span>Rendered Bitplane {bitIndex} ({channel.toUpperCase()} Channel)</span>
              </h3>
              {isDemoSample && (
                <span className="text-[10px] font-mono-custom px-2 py-0.5 rounded bg-[#c9a876]/10 text-[#c9a876] border border-[#c9a876]/30">
                  DEMO SAMPLE (Synthetic LSB Noise)
                </span>
              )}
            </div>

            <div className="aspect-video bg-[#000000] rounded overflow-hidden border border-[#24272c] flex items-center justify-center p-2">
              <canvas ref={bitplaneCanvasRef} className="w-full h-full object-contain" />
            </div>

            <p className="text-[11px] text-[#93979e] font-mono-custom leading-normal">
              In normal unedited photographs, Bitplane 0 (LSB) looks like uniform static grain. If Bitplane 0 shows distinct sharp text, shapes, or solid geometric blocks, LSB steganography is active.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
