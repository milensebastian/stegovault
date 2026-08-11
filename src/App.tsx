import React, { useState } from 'react';
import { StegoMode } from './types';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { ImageStegoSection } from './components/ImageStegoSection';
import { AudioStegoSection } from './components/AudioStegoSection';
import { TextStegoSection } from './components/TextStegoSection';
import { ForensicStudio } from './components/ForensicStudio';
import { AICoverGenerator } from './components/AICoverGenerator';

export default function App() {
  const [currentMode, setCurrentMode] = useState<StegoMode>('image');

  return (
    <div className="min-h-screen bg-[#0b0c0e] text-[#ece8e0] font-sans flex flex-col selection:bg-[#c9a876]/30">
      {/* Navigation Topbar */}
      <Navbar currentMode={currentMode} onSelectMode={setCurrentMode} />

      {/* Hero Banner Section */}
      <Hero />

      {/* Main Workspace Workspace Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        {currentMode === 'image' && <ImageStegoSection />}
        {currentMode === 'audio' && <AudioStegoSection />}
        {currentMode === 'text' && <TextStegoSection />}
        {currentMode === 'forensics' && <ForensicStudio />}
        {currentMode === 'ai-generator' && <AICoverGenerator />}
      </main>

      {/* Editorial Footer */}
      <footer className="border-t border-[#24272c] py-8 bg-[#0b0c0e]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono-custom text-xs text-[#93979e]">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-[#8fae82]" />
            <span>STEGOVAULT — Client-side processing. Close the browser tab and no trace remains.</span>
          </div>
          <div className="flex space-x-4 text-[11px] text-[#53575d]">
            <span>NO SERVER STORAGE</span>
            <span>·</span>
            <span>NO DATABASE</span>
            <span>·</span>
            <span>NO ACCOUNTS</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
