import React, { useState } from 'react';
import { evaluatePasswordStrength } from '../crypto';
import { Eye, EyeOff, Key, ShieldAlert, ShieldCheck } from 'lucide-react';

interface PasswordStrengthMeterProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  id?: string;
  showStrength?: boolean;
}

export const PasswordStrengthMeter: React.FC<PasswordStrengthMeterProps> = ({
  value,
  onChange,
  placeholder = 'Enter a secret passphrase...',
  label = 'Encryption Passphrase',
  id = 'passphrase-input',
  showStrength = true,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const strength = evaluatePasswordStrength(value);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="block text-xs font-mono-custom tracking-wider text-[#93979e] uppercase">
          {label}
        </label>
        {value && showStrength && (
          <span className="text-[10px] font-mono-custom text-[#c9a876]">
            Entropy: {strength.entropyBits} bits
          </span>
        )}
      </div>

      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#53575d]">
          <Key className="w-4 h-4" />
        </div>
        <input
          id={id}
          type={showPassword ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-[#16181c] border border-[#24272c] focus:border-[#c9a876] rounded py-2.5 pl-10 pr-10 text-sm font-mono-custom text-[#ece8e0] placeholder-[#53575d] transition-colors focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#93979e] hover:text-[#ece8e0] transition-colors"
          title={showPassword ? 'Hide password' : 'Show password'}
        >
          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>

      {/* Password Strength Visual Meter */}
      {value && showStrength && (
        <div className="space-y-1.5 pt-1">
          <div className="grid grid-cols-4 gap-1.5 h-1">
            {[1, 2, 3, 4].map((level) => {
              let activeColor = 'bg-[#24272c]';
              if (strength.score >= level) {
                if (strength.score === 1) activeColor = 'bg-[#c47461]'; // Weak
                else if (strength.score === 2) activeColor = 'bg-[#c9a876]'; // Moderate
                else activeColor = 'bg-[#8fae82]'; // Strong / Fortress
              }
              return (
                <div
                  key={level}
                  className={`h-full rounded-full transition-all duration-300 ${activeColor}`}
                />
              );
            })}
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono-custom">
            <div className="flex items-center space-x-1">
              {strength.score >= 3 ? (
                <ShieldCheck className="w-3.5 h-3.5 text-[#8fae82]" />
              ) : (
                <ShieldAlert className="w-3.5 h-3.5 text-[#c47461]" />
              )}
              <span
                className={
                  strength.score === 1
                    ? 'text-[#c47461]'
                    : strength.score === 2
                    ? 'text-[#c9a876]'
                    : 'text-[#8fae82]'
                }
              >
                {strength.feedback}
              </span>
            </div>
            <span className="text-[#93979e] text-[10px]">Est. crack time: {strength.crackTime}</span>
          </div>
        </div>
      )}
    </div>
  );
};
