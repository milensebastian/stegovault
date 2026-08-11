import React from 'react';
import { StegoMode } from '../types';
import { Shield, Image, Music, FileText, Eye, Sparkles, Cpu } from 'lucide-react';

interface NavbarProps {
  currentMode: StegoMode;
  onSelectMode: (mode: StegoMode) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentMode, onSelectMode }) => {
  const modes: { id: StegoMode; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: 'image', label: 'IMAGE LSB', icon: <Image className="w-4 h-4" /> },
    { id: 'audio', label: 'AUDIO WAV', icon: <Music className="w-4 h-4" /> },
    { id: 'text', label: 'ZERO-WIDTH TEXT', icon: <FileText className="w-4 h-4" /> },
    { id: 'forensics', label: 'BITPLANE ANALYZER', icon: <Eye className="w-4 h-4" />, badge: 'LAB' },
    { id: 'ai-generator', label: 'AI CARRIER', icon: <Sparkles className="w-4 h-4" />, badge: 'AI' },
  ];

  return (
    <header className="sticky top-0 z-50 bg-[#0b0c0e]/90 backdrop-blur-md border-b border-[#24272c]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => onSelectMode('image')}>
            <div className="relative w-8 h-8 rounded-sm bg-[#16181c] border border-[#383c42] flex items-center justify-center text-[#c9a876]">
              <Shield className="w-5 h-5 stroke-[1.5]" />
              <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#8fae82] animate-pulse" />
            </div>
            <div>
              <div className="font-mono-custom text-sm font-bold tracking-widest text-[#ece8e0] flex items-center gap-1.5">
                STEGO<span className="text-[#c9a876]">VAULT</span>
              </div>
              <div className="text-[10px] font-mono-custom text-[#93979e] tracking-wider uppercase hidden sm:block">
                Client-Side Cipher Studio
              </div>
            </div>
          </div>

          {/* Mode Selector Tabs */}
          <nav className="flex items-center gap-1 bg-[#0f1114] p-1 rounded-md border border-[#24272c] overflow-x-auto max-w-full">
            {modes.map((m) => {
              const isActive = currentMode === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => onSelectMode(m.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-mono-custom tracking-wider transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-[#c9a876] text-[#0b0c0e] font-semibold shadow-sm'
                      : 'text-[#93979e] hover:text-[#ece8e0] hover:bg-[#16181c]'
                  }`}
                >
                  {m.icon}
                  <span>{m.label}</span>
                  {m.badge && (
                    <span
                      className={`text-[9px] px-1 py-0.2 rounded font-sans uppercase ${
                        isActive
                          ? 'bg-[#0b0c0e]/20 text-[#0b0c0e]'
                          : 'bg-[#24272c] text-[#c9a876]'
                      }`}
                    >
                      {m.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* System Status Indicator */}
          <div className="hidden lg:flex items-center space-x-2 text-[11px] font-mono-custom text-[#93979e]">
            <Cpu className="w-3.5 h-3.5 text-[#8fae82]" />
            <span className="text-[#8fae82]">AES-256-GCM READY</span>
          </div>
        </div>
      </div>
    </header>
  );
};
