import React, { useState } from 'react';
import { Sparkles, RefreshCw, Copy, Check, ShieldCheck, FileText, Bot } from 'lucide-react';

export const AICoverGenerator: React.FC = () => {
  const [topic, setTopic] = useState('Project documentation & code review');
  const [style, setStyle] = useState('professional');
  const [targetLength, setTargetLength] = useState(300);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCover, setGeneratedCover] = useState<string | null>(null);
  const [aiAnalysisReport, setAiAnalysisReport] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerateCover = async () => {
    setIsGenerating(true);
    setGeneratedCover(null);

    try {
      const res = await fetch('/api/ai/generate-cover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, style, targetLength }),
      });

      const data = await res.json();
      if (data.success && data.coverText) {
        setGeneratedCover(data.coverText);
      } else {
        setGeneratedCover('Failed to generate cover text from AI service.');
      }
    } catch (err) {
      console.error(err);
      setGeneratedCover('Hi Team,\n\nI have finished reviewing the latest API documentation and unit tests. Everything is aligned with our release schedule.\n\nBest regards,');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRunAiAnalysis = async () => {
    setIsAnalyzing(true);
    setAiAnalysisReport(null);

    try {
      const res = await fetch('/api/ai/analyze-stego', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'educational-security-overview',
          isGeneralOverview: true,
        }),
      });

      const data = await res.json();
      if (data.success && data.analysis) {
        setAiAnalysisReport(data.analysis);
      }
    } catch (err) {
      console.error(err);
      setAiAnalysisReport('### AI Steganographic Security Assessment\n- **Payload Confidentiality**: AES-256-GCM protects the confidentiality and integrity of the hidden payload. It does not guarantee statistical undetectability of the steganographic embedding.\n- **Resilience**: LSB embedding is highly sensitive to lossy image/audio re-compression.\n- **Statistical Risk**: High-capacity embedding alters bitplane noise distributions regardless of payload encryption.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8">
      <div className="border-b border-[#24272c] pb-3 flex items-center justify-between">
        <div>
          <h2 className="font-serif-custom text-2xl italic font-normal text-[#ece8e0] flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#c9a876]" />
            <span>AI Natural Cover Text Generator & Forensic Advisor</span>
          </h2>
          <p className="text-xs font-mono-custom text-[#93979e] mt-1">
            Powered by Gemini AI (server-side proxy). Generates realistic, natural-sounding cover texts for zero-width unicode steganography or provides security assessments.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: AI Cover Generator Form */}
        <div className="lg:col-span-6 space-y-6 bg-[#121417] p-5 rounded border border-[#24272c]">
          <h3 className="text-xs font-mono-custom tracking-wider text-[#c9a876] uppercase flex items-center space-x-2">
            <Bot className="w-4 h-4 text-[#c9a876]" />
            <span>Generate Custom Cover Text Carrier</span>
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-mono-custom text-[#93979e] uppercase mb-1">
                Topic / Context
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g., Weekly team update, Cooking recipe, Fitness log..."
                className="w-full bg-[#16181c] border border-[#24272c] focus:border-[#c9a876] rounded p-2.5 text-xs font-mono-custom text-[#ece8e0] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-mono-custom text-[#93979e] uppercase mb-1">
                Writing Tone / Style
              </label>
              <select
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                className="w-full bg-[#16181c] border border-[#24272c] focus:border-[#c9a876] rounded p-2.5 text-xs font-mono-custom text-[#ece8e0] focus:outline-none cursor-pointer"
              >
                <option value="professional">Professional Corporate Email</option>
                <option value="casual">Casual Chat Message</option>
                <option value="academic">Academic Research Abstract</option>
                <option value="developer">Developer Github Commit / PR Notes</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono-custom text-[#93979e] uppercase mb-1">
                Target Character Capacity: ~{targetLength} Chars
              </label>
              <input
                type="range"
                min={150}
                max={1000}
                step={50}
                value={targetLength}
                onChange={(e) => setTargetLength(parseInt(e.target.value))}
                className="w-full accent-[#c9a876] cursor-pointer"
              />
            </div>

            <button
              onClick={handleGenerateCover}
              disabled={isGenerating}
              className="w-full py-3 px-4 rounded bg-[#c9a876] hover:bg-[#a58c62] text-[#0b0c0e] font-mono-custom font-bold text-xs tracking-widest uppercase transition-all flex items-center justify-center space-x-2 cursor-pointer"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>GEMINI AI IS SYNTHESIZING COVER TEXT...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>GENERATE INNOCENT COVER CARRIER</span>
                </>
              )}
            </button>

            {generatedCover && (
              <div className="space-y-3 pt-2">
                <textarea
                  readOnly
                  value={generatedCover}
                  rows={6}
                  className="w-full bg-[#0f1114] border border-[#24272c] rounded p-3 text-xs font-mono-custom text-[#ece8e0] focus:outline-none"
                />
                <button
                  onClick={() => copyToClipboard(generatedCover)}
                  className="w-full py-2 px-3 rounded bg-[#16181c] border border-[#24272c] hover:border-[#c9a876] text-xs font-mono-custom text-[#ece8e0] flex items-center justify-center space-x-2 cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-[#8fae82]" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'COPIED TO CLIPBOARD!' : 'COPY GENERATED COVER TEXT'}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: AI Forensic Security Advisor */}
        <div className="lg:col-span-6 space-y-6 bg-[#121417] p-5 rounded border border-[#24272c]">
          <h3 className="text-xs font-mono-custom tracking-wider text-[#8fae82] uppercase flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-[#8fae82]" />
            <span>AI Steganographic Security Advisor</span>
          </h3>

          <p className="text-xs font-mono-custom text-[#93979e] leading-relaxed">
            Run an AI assessment on steganographic stealth, resilience against compression algorithms, and statistical detection risks.
          </p>

          <button
            onClick={handleRunAiAnalysis}
            disabled={isAnalyzing}
            className="w-full py-3 px-4 rounded bg-[#16181c] border border-[#8fae82] hover:bg-[#8fae82] text-[#8fae82] hover:text-[#0b0c0e] font-mono-custom font-bold text-xs tracking-widest uppercase transition-all flex items-center justify-center space-x-2 cursor-pointer"
          >
            {isAnalyzing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>EVALUATING STEALTH METRICS...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>GENERATE FORENSIC SECURITY REPORT</span>
              </>
            )}
          </button>

          {aiAnalysisReport && (
            <div className="p-4 rounded bg-[#0f1114] border border-[#24272c] text-xs font-mono-custom text-[#ece8e0] leading-relaxed whitespace-pre-wrap">
              {aiAnalysisReport}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
