export interface EncryptedPayloadHeader {
  magic: string; // "STGV1"
  version: number;
  salt: string; // base64
  iv: string; // base64
  filename?: string;
  mimeType?: string;
}

export type StegoMode = 'text' | 'image' | 'audio' | 'forensics' | 'ai-generator';

export interface BitplaneOption {
  bit: number; // 0 (LSB) to 7 (MSB)
  channel: 'all' | 'red' | 'green' | 'blue' | 'alpha' | 'luminance';
}

export interface ImageMeta {
  width: number;
  height: number;
  totalPixels: number;
  maxCapacityBytes: number;
  name: string;
  size: number;
  type: string;
}

export interface AudioMeta {
  duration: number;
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  totalSamples: number;
  maxCapacityBytes: number;
  name: string;
  size: number;
}

export interface ForensicResult {
  entropy: number;
  chiSquarePValue: number;
  lsbNoiseRatio: number;
  suspicionScore: number; // 0 - 100%
  verdict: 'clean' | 'suspicious' | 'high_statistical_anomaly';
  details: string;
}

export interface PasswordStrength {
  score: number; // 0 to 4
  entropyBits: number;
  feedback: string;
  crackTime: string;
}
