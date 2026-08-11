import { AudioMeta } from '../types';

export interface ParsedWav {
  numChannels: number;
  sampleRate: number;
  bitsPerSample: number;
  audioFormat: number;
  dataOffset: number;
  dataSize: number;
  totalSamples: number;
  samples: Int16Array;
  buffer: ArrayBuffer;
}

const STGV_AUDIO_MAGIC = new Uint8Array([0x53, 0x54, 0x47, 0x56]); // "STGV"
const AUDIO_HEADER_SIZE = 8; // 4 bytes STGV + 4 bytes length

/**
 * Parses raw ArrayBuffer of a .wav file with strict chunk & format validation.
 */
export function parseWavFile(buffer: ArrayBuffer): ParsedWav {
  if (!buffer || buffer.byteLength < 44) {
    throw new Error('Invalid WAV file: buffer too small or corrupt.');
  }

  const view = new DataView(buffer);

  // Check RIFF header
  const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  if (riff !== 'RIFF') {
    throw new Error('Invalid WAV file: missing RIFF magic header.');
  }

  const wave = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));
  if (wave !== 'WAVE') {
    throw new Error('Invalid WAV file: missing WAVE format tag.');
  }

  let dataOffset = 12;
  let numChannels = 1;
  let sampleRate = 44100;
  let bitsPerSample = 16;
  let audioFormat = 1; // 1 = PCM
  let dataSize = 0;
  let foundFmt = false;
  let foundData = false;

  // Walk through chunks safely
  while (dataOffset + 8 <= view.byteLength) {
    const chunkId = String.fromCharCode(
      view.getUint8(dataOffset),
      view.getUint8(dataOffset + 1),
      view.getUint8(dataOffset + 2),
      view.getUint8(dataOffset + 3)
    );
    const chunkSize = view.getUint32(dataOffset + 4, true);

    if (chunkId === 'fmt ') {
      if (dataOffset + 8 + 16 > view.byteLength) {
        throw new Error('Invalid WAV file: truncated fmt chunk.');
      }
      audioFormat = view.getUint16(dataOffset + 8, true);
      numChannels = view.getUint16(dataOffset + 10, true);
      sampleRate = view.getUint32(dataOffset + 12, true);
      bitsPerSample = view.getUint16(dataOffset + 22, true);
      foundFmt = true;
    } else if (chunkId === 'data') {
      const remainingBytes = view.byteLength - (dataOffset + 8);
      if (remainingBytes < chunkSize) {
        throw new Error(`Invalid WAV file: data chunk is truncated or incomplete (expected ${chunkSize} bytes, found ${remainingBytes} bytes).`);
      }
      dataSize = chunkSize;
      dataOffset += 8; // move to start of PCM sample data
      foundData = true;
      break;
    }

    // Advance to next chunk with 2-byte word padding
    const alignedSize = chunkSize + (chunkSize % 2);
    dataOffset += 8 + alignedSize;
  }

  if (!foundFmt || !foundData) {
    throw new Error('Invalid WAV file: missing fmt or data chunk.');
  }

  // Validate PCM audio format (Format 1 = uncompressed PCM)
  if (audioFormat !== 1) {
    throw new Error(`Unsupported WAV audio format (Format Tag ${audioFormat}). Only uncompressed PCM WAV audio files are supported.`);
  }

  if (bitsPerSample !== 16 && bitsPerSample !== 8) {
    throw new Error(`Unsupported WAV bit depth: ${bitsPerSample}-bit. Please use 16-bit or 8-bit PCM WAV.`);
  }

  const bytesPerSample = bitsPerSample / 8;
  const totalSamples = Math.floor(dataSize / bytesPerSample);

  if (totalSamples <= 0) {
    throw new Error('Invalid WAV file: zero audio samples found in data chunk.');
  }

  // Extract PCM sample array
  const samples = new Int16Array(totalSamples);
  if (bitsPerSample === 16) {
    for (let i = 0; i < totalSamples; i++) {
      samples[i] = view.getInt16(dataOffset + i * 2, true);
    }
  } else {
    // 8-bit unsigned PCM
    for (let i = 0; i < totalSamples; i++) {
      const u8 = view.getUint8(dataOffset + i);
      samples[i] = u8; // Store 0..255 directly for 8-bit PCM LSB operations
    }
  }

  return {
    numChannels,
    sampleRate,
    bitsPerSample,
    audioFormat,
    dataOffset,
    dataSize,
    totalSamples,
    samples,
    buffer,
  };
}

/**
 * Calculates audio max capacity in bytes.
 */
export function calculateAudioCapacity(totalSamples: number): number {
  // 1 bit per sample LSB.
  const totalBits = totalSamples;
  return Math.max(0, Math.floor(totalBits / 8) - AUDIO_HEADER_SIZE);
}

/**
 * Embeds byte payload into PCM audio sample LSBs and returns a new encoded WAV Blob.
 */
export function embedPayloadInWav(wav: ParsedWav, payload: Uint8Array): Blob {
  const maxCap = calculateAudioCapacity(wav.totalSamples);
  const length = payload.length;

  if (length > maxCap) {
    throw new Error(`Payload size (${length} B) exceeds audio capacity (${maxCap} B).`);
  }

  // Build full payload with STGV versioned magic header + 4-byte length prefix
  const fullPayload = new Uint8Array(AUDIO_HEADER_SIZE + length);
  fullPayload.set(STGV_AUDIO_MAGIC, 0);
  fullPayload[4] = (length >>> 24) & 0xff;
  fullPayload[5] = (length >>> 16) & 0xff;
  fullPayload[6] = (length >>> 8) & 0xff;
  fullPayload[7] = length & 0xff;
  fullPayload.set(payload, AUDIO_HEADER_SIZE);

  // Clone original buffer to preserve header structure
  const outBuffer = wav.buffer.slice(0);
  const view = new DataView(outBuffer);

  let sampleIdx = 0;

  for (let b = 0; b < fullPayload.length; b++) {
    const byteVal = fullPayload[b];
    for (let bitShift = 7; bitShift >= 0; bitShift--) {
      if (sampleIdx >= wav.totalSamples) break;

      const bit = (byteVal >>> bitShift) & 1;

      if (wav.bitsPerSample === 16) {
        let sample = wav.samples[sampleIdx];
        sample = (sample & ~1) | bit;
        wav.samples[sampleIdx] = sample;
        view.setInt16(wav.dataOffset + sampleIdx * 2, sample, true);
      } else {
        let u8 = wav.samples[sampleIdx] & 0xff;
        u8 = (u8 & ~1) | bit;
        wav.samples[sampleIdx] = u8;
        view.setUint8(wav.dataOffset + sampleIdx, u8);
      }

      sampleIdx++;
    }
  }

  return new Blob([outBuffer], { type: 'audio/wav' });
}

/**
 * Extracts hidden payload from WAV PCM audio sample LSBs.
 */
export function extractPayloadFromWav(wav: ParsedWav): Uint8Array {
  const samples = wav.samples;
  let sampleIdx = 0;

  // Extract 8-byte header (4 bytes magic + 4 bytes length)
  const headerBytes = new Uint8Array(AUDIO_HEADER_SIZE);

  for (let b = 0; b < AUDIO_HEADER_SIZE; b++) {
    let byteVal = 0;
    for (let bit = 0; bit < 8; bit++) {
      if (sampleIdx >= samples.length) {
        throw new Error('Reached end of audio file without finding full header.');
      }
      const lsb = samples[sampleIdx] & 1;
      byteVal = (byteVal << 1) | lsb;
      sampleIdx++;
    }
    headerBytes[b] = byteVal;
  }

  // Check for "STGV" versioned magic tag
  const isVersioned =
    headerBytes[0] === STGV_AUDIO_MAGIC[0] &&
    headerBytes[1] === STGV_AUDIO_MAGIC[1] &&
    headerBytes[2] === STGV_AUDIO_MAGIC[2] &&
    headerBytes[3] === STGV_AUDIO_MAGIC[3];

  let lengthHeader = 0;
  if (isVersioned) {
    lengthHeader =
      (headerBytes[4] << 24) |
      (headerBytes[5] << 16) |
      (headerBytes[6] << 8) |
      headerBytes[7];
  } else {
    // Fallback for legacy 4-byte header
    lengthHeader =
      (headerBytes[0] << 24) |
      (headerBytes[1] << 16) |
      (headerBytes[2] << 8) |
      headerBytes[3];

    // Rewind sampleIdx by 4 bytes (32 samples) for legacy format
    sampleIdx = 32;
  }

  const maxUsableCap = calculateAudioCapacity(wav.totalSamples);
  const remainingSamples = samples.length - sampleIdx;
  if (lengthHeader <= 0 || lengthHeader > maxUsableCap || lengthHeader * 8 > remainingSamples) {
    throw new Error('No valid steganographic payload detected or truncated audio payload.');
  }

  const payload = new Uint8Array(lengthHeader);
  for (let i = 0; i < lengthHeader; i++) {
    let byteVal = 0;
    for (let bit = 0; bit < 8; bit++) {
      if (sampleIdx >= samples.length) {
        throw new Error('Corrupted audio stego payload: premature end of audio file.');
      }
      const lsb = samples[sampleIdx] & 1;
      byteVal = (byteVal << 1) | lsb;
      sampleIdx++;
    }
    payload[i] = byteVal;
  }

  return payload;
}

/**
 * Converts Int16Array samples to normalized Float32Array (-1.0 to 1.0) for canvas visualization.
 */
export function getWaveformPeakPoints(samples: Int16Array, numPoints = 200): Float32Array {
  const step = Math.max(1, Math.floor(samples.length / numPoints));
  const peaks = new Float32Array(numPoints);

  for (let i = 0; i < numPoints; i++) {
    let max = 0;
    const start = i * step;
    const end = Math.min(start + step, samples.length);

    for (let j = start; j < end; j++) {
      const val = Math.abs(samples[j]) / 32768;
      if (val > max) max = val;
    }
    peaks[i] = max;
  }

  return peaks;
}
