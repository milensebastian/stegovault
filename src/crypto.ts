import { PasswordStrength } from './types';

const MAGIC_HEADER = new Uint8Array([83, 84, 71, 86, 49]); // "STGV1"

/**
 * Derives an AES-256-GCM key from a passphrase and salt using PBKDF2 (250,000 iterations).
 */
export async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 250000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-256-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts arbitrary bytes or text using AES-256-GCM with PBKDF2 salt and IV.
 * Formats data: [MAGIC (5b)][SALT (16b)][IV (12b)][CIPHERTEXT (...)]
 */
export async function encryptData(data: Uint8Array, passphrase?: string): Promise<Uint8Array> {
  if (!passphrase || passphrase.trim() === '') {
    // Unencrypted raw payload with STGV0 magic tag
    const header = new Uint8Array([83, 84, 71, 86, 48]); // "STGV0"
    const result = new Uint8Array(header.length + data.length);
    result.set(header, 0);
    result.set(data, header.length);
    return result;
  }

  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);

  const ciphertext = await window.crypto.subtle.encrypt(
    { name: 'AES-256-GCM', iv },
    key,
    data
  );

  const cipherBytes = new Uint8Array(ciphertext);
  const result = new Uint8Array(MAGIC_HEADER.length + salt.length + iv.length + cipherBytes.length);

  result.set(MAGIC_HEADER, 0);
  result.set(salt, MAGIC_HEADER.length);
  result.set(iv, MAGIC_HEADER.length + salt.length);
  result.set(cipherBytes, MAGIC_HEADER.length + salt.length + iv.length);

  return result;
}

/**
 * Decrypts structured STGV payload.
 */
export async function decryptData(packedData: Uint8Array, passphrase?: string): Promise<Uint8Array> {
  if (packedData.length < 5) {
    throw new Error('Invalid payload: data too short.');
  }

  // Check magic STGV0 (unencrypted)
  if (packedData[0] === 83 && packedData[1] === 84 && packedData[2] === 71 && packedData[3] === 86 && packedData[4] === 48) {
    return packedData.slice(5);
  }

  // Check magic STGV1 (encrypted)
  const isEncrypted = packedData[0] === 83 && packedData[1] === 84 && packedData[2] === 71 && packedData[3] === 86 && packedData[4] === 49;
  
  if (!isEncrypted) {
    // Fallback: assume raw text if magic header is absent
    return packedData;
  }

  if (!passphrase || passphrase.trim() === '') {
    throw new Error('This payload is password-protected. Please enter the passphrase.');
  }

  if (packedData.length < 5 + 16 + 12) {
    throw new Error('Corrupted encrypted payload: header incomplete.');
  }

  const salt = packedData.slice(5, 21);
  const iv = packedData.slice(21, 33);
  const ciphertext = packedData.slice(33);

  const key = await deriveKey(passphrase, salt);

  try {
    const decrypted = await window.crypto.subtle.decrypt(
      { name: 'AES-256-GCM', iv },
      key,
      ciphertext
    );
    return new Uint8Array(decrypted);
  } catch {
    throw new Error('Decryption failed. Incorrect password or corrupted payload.');
  }
}

/**
 * Encrypts string text to base64 output
 */
export async function encryptTextToBase64(text: string, passphrase?: string): Promise<string> {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(text);
  const encrypted = await encryptData(bytes, passphrase);
  return bytesToBase64(encrypted);
}

/**
 * Decrypts base64 string to original text
 */
export async function decryptTextFromBase64(base64: string, passphrase?: string): Promise<string> {
  const bytes = base64ToBytes(base64.trim());
  const decrypted = await decryptData(bytes, passphrase);
  const decoder = new TextDecoder('utf-8', { fatal: true });
  return decoder.decode(decrypted);
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  const cleanBase64 = base64.replace(/\s+/g, '');
  const binary = window.atob(cleanBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function evaluatePasswordStrength(password: string): PasswordStrength {
  if (!password) {
    return { score: 0, entropyBits: 0, feedback: 'Enter a passphrase', crackTime: '0 seconds' };
  }

  let charsetSize = 0;
  if (/[a-z]/.test(password)) charsetSize += 26;
  if (/[A-Z]/.test(password)) charsetSize += 26;
  if (/[0-9]/.test(password)) charsetSize += 10;
  if (/[^a-zA-Z0-9]/.test(password)) charsetSize += 32;

  const entropyBits = Math.floor(password.length * Math.log2(Math.max(charsetSize, 1)));

  let score = 0;
  if (entropyBits >= 28) score = 1;
  if (entropyBits >= 45) score = 2;
  if (entropyBits >= 60) score = 3;
  if (entropyBits >= 80) score = 4;

  let feedback = 'Weak passphrase';
  let crackTime = 'A few seconds';

  if (score === 1) {
    feedback = 'Fair passphrase (basic security)';
    crackTime = 'Minutes to hours';
  } else if (score === 2) {
    feedback = 'Moderate security';
    crackTime = 'Days to months';
  } else if (score === 3) {
    feedback = 'Strong passphrase';
    crackTime = 'Years to decades (High cost)';
  } else if (score === 4) {
    feedback = 'Very Strong Passphrase';
    crackTime = 'High Estimated Entropy';
  }

  return { score, entropyBits, feedback, crackTime };
}
