import React from 'react';
import { Lock, Cpu, EyeOff, ShieldCheck, Zap } from 'lucide-react';

export const Hero: React.FC = () => {
  return (
    <section className="relative border-b border-[#24272c] py-12 md:py-16 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Hero Content */}
          <div className="lg:col-span-8 space-y-5">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-[#16181c] border border-[#24272c] text-xs font-mono-custom text-[#c9a876]">
              <Lock className="w-3.5 h-3.5 text-[#c9a876]" />
              <span>ZERO NETWORK TRANSMISSION · ALL CALCULATIONS IN BROWSER MEMORY</span>
            </div>

            <h1 className="font-serif-custom text-4xl sm:text-6xl lg:text-7xl font-normal italic tracking-tight leading-[0.95] text-[#ece8e0]">
              STEGO<em className="not-italic font-light text-[#c9a876]">VAULT</em>
            </h1>

            <p className="font-mono-custom text-sm text-[#93979e] max-w-2xl leading-relaxed">
              // Hide encrypted payloads in images, audio, and text. Leave zero visual or acoustic trace. Protected by military-grade AES-256-GCM encryption with PBKDF2 key derivation.
            </p>

            {/* Technical Capability Badges */}
            <div className="flex flex-wrap gap-2 pt-2">
              <span className="font-mono-custom text-[11px] px-2.5 py-1 rounded bg-[#121417] border border-[#24272c] text-[#ece8e0]">
                <strong className="text-[#c9a876] font-medium">AES-256-GCM</strong> CIPHER
              </span>
              <span className="font-mono-custom text-[11px] px-2.5 py-1 rounded bg-[#121417] border border-[#24272c] text-[#ece8e0]">
                <strong className="text-[#c9a876] font-medium">PBKDF2</strong> 250K ITER
              </span>
              <span className="font-mono-custom text-[11px] px-2.5 py-1 rounded bg-[#121417] border border-[#24272c] text-[#ece8e0]">
                <strong className="text-[#8fae82] font-medium">LSB</strong> EMBEDDING
              </span>
              <span className="font-mono-custom text-[11px] px-2.5 py-1 rounded bg-[#121417] border border-[#24272c] text-[#ece8e0]">
                <strong className="text-[#c9a876] font-medium">ZERO-WIDTH</strong> UNICODE
              </span>
              <span className="font-mono-custom text-[11px] px-2.5 py-1 rounded bg-[#121417] border border-[#24272c] text-[#ece8e0]">
                BITPLANE FORENSICS
              </span>
            </div>
          </div>

          {/* Right Rotating Vault Seal */}
          <div className="lg:col-span-4 flex justify-center lg:justify-end">
            <div className="relative w-44 h-44 sm:w-52 sm:h-52">
              <svg className="w-full h-full opacity-85" viewBox="0 0 200 200">
                <g className="animate-[spin_90s_linear_infinite]" style={{ transformOrigin: '100px 100px' }}>
                  <circle cx="100" cy="100" r="92" fill="none" stroke="#24272c" strokeWidth="1" />
                  <circle cx="100" cy="100" r="84" fill="none" stroke="#c9a876" strokeWidth="1" strokeDasharray="4 8" opacity="0.6" />
                  {/* Outer ticks */}
                  <line x1="100" y1="8" x2="100" y2="16" stroke="#53575d" strokeWidth="1.5" />
                  <line x1="100" y1="184" x2="100" y2="192" stroke="#53575d" strokeWidth="1.5" />
                  <line x1="8" y1="100" x2="16" y2="100" stroke="#53575d" strokeWidth="1.5" />
                  <line x1="184" y1="100" x2="192" y2="100" stroke="#53575d" strokeWidth="1.5" />
                </g>
                <g className="animate-[spin_120s_linear_infinite_reverse]" style={{ transformOrigin: '100px 100px' }}>
                  <circle cx="100" cy="100" r="64" fill="none" stroke="#383c42" strokeWidth="1" strokeDasharray="2 6" />
                </g>
                <circle cx="100" cy="100" r="4" fill="#c9a876" />
                <text x="100" y="125" textAnchor="middle" className="font-mono-custom text-[7px] fill-[#93979e] tracking-[0.2em] uppercase">
                  NO TRACE
                </text>
              </svg>
            </div>
          </div>
        </div>

        {/* Security Assurances Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-10 pt-8 border-t border-[#24272c]/60">
          <div className="flex items-start space-x-3 p-3 rounded bg-[#121417]/60 border border-[#24272c]/50">
            <ShieldCheck className="w-5 h-5 text-[#8fae82] shrink-0 mt-0.5" />
            <div>
              <h4 className="font-mono-custom text-xs font-semibold text-[#ece8e0] uppercase">Complete Ephemerality</h4>
              <p className="text-xs text-[#93979e] mt-1">Nothing is saved to servers or cloud storage. Close the browser tab and all key material and temporary buffers are purged instantly.</p>
            </div>
          </div>

          <div className="flex items-start space-x-3 p-3 rounded bg-[#121417]/60 border border-[#24272c]/50">
            <EyeOff className="w-5 h-5 text-[#c9a876] shrink-0 mt-0.5" />
            <div>
              <h4 className="font-mono-custom text-xs font-semibold text-[#ece8e0] uppercase">Visually Imperceptible</h4>
              <p className="text-xs text-[#93979e] mt-1">Least-Significant-Bit (LSB) changes modify pixel color values by less than 0.4%, remaining imperceptible to human visual observation.</p>
            </div>
          </div>

          <div className="flex items-start space-x-3 p-3 rounded bg-[#121417]/60 border border-[#24272c]/50">
            <Zap className="w-5 h-5 text-[#8fae82] shrink-0 mt-0.5" />
            <div>
              <h4 className="font-mono-custom text-xs font-semibold text-[#ece8e0] uppercase">Hardware Accelerated</h4>
              <p className="text-xs text-[#93979e] mt-1">Web Crypto API and HTML5 Canvas processing handle megapixel image arrays and audio signals natively at 60 FPS.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
