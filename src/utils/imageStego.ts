import { ForensicResult, ImageMeta } from '../types';

/**
 * Versioned Stego Header Constants
 * Magic: "STGV" (0x53, 0x54, 0x47, 0x56)
 * Header layout (12 bytes total):
 * 0..3: "STGV"
 * 4: Version (0x01)
 * 5: bitsPerChannel (1..4)
 * 6: flags (0x00)
 * 7: reserved (0x00)
 * 8..11: payload length (uint32 big-endian)
 */
const STGV_MAGIC = new Uint8Array([0x53, 0x54, 0x47, 0x56]); // "STGV"
const HEADER_SIZE = 12;

/**
 * Calculates max payload capacity for an image in bytes.
 * Default bitsPerChannel = 1 (1 bit in R, G, and B channel = 3 bits/pixel).
 */
export function calculateImageCapacity(width: number, height: number, bitsPerChannel = 1): number {
  const totalPixels = width * height;
  const bitsPerPixel = bitsPerChannel * 3; // R, G, B channels
  const totalBitsAvailable = totalPixels * bitsPerPixel;
  const dataBytes = Math.floor(totalBitsAvailable / 8) - HEADER_SIZE;
  return Math.max(0, dataBytes);
}

/**
 * Embeds byte payload into ImageData using Least Significant Bit (LSB) replacement.
 * Prepends versioned STGV header metadata containing bitsPerChannel and payload length.
 * RGB channels are modified. Alpha channel is preserved.
 */
export function embedPayloadInImageData(
  imageData: ImageData,
  payload: Uint8Array,
  bitsPerChannel = 1
): ImageData {
  const data = imageData.data;
  const totalPixels = imageData.width * imageData.height;

  const validBitsPerChannel = Math.min(4, Math.max(1, bitsPerChannel));

  // Build 12-byte STGV versioned header
  const length = payload.length;
  const fullPayload = new Uint8Array(HEADER_SIZE + length);
  fullPayload.set(STGV_MAGIC, 0);
  fullPayload[4] = 0x01; // Version 1
  fullPayload[5] = validBitsPerChannel;
  fullPayload[6] = 0x00; // Flags
  fullPayload[7] = 0x00; // Reserved
  fullPayload[8] = (length >>> 24) & 0xff;
  fullPayload[9] = (length >>> 16) & 0xff;
  fullPayload[10] = (length >>> 8) & 0xff;
  fullPayload[11] = length & 0xff;
  fullPayload.set(payload, HEADER_SIZE);

  const maxCapacityBytes = calculateImageCapacity(imageData.width, imageData.height, validBitsPerChannel) + HEADER_SIZE;
  if (fullPayload.length > maxCapacityBytes) {
    throw new Error(`Payload size (${payload.length} B) exceeds maximum capacity (${maxCapacityBytes - HEADER_SIZE} B) for ${validBitsPerChannel}-bit LSB mode.`);
  }

  let byteIdx = 0;
  let bitShift = 7; // Current bit position in payload byte (MSB first)

  // Mask for clearing specified LSB bits
  const mask = (0xff << validBitsPerChannel) & 0xff;

  for (let p = 0; p < totalPixels && byteIdx < fullPayload.length; p++) {
    const pixelOffset = p * 4;

    // Iterate through R, G, B channels (channel 0, 1, 2). Alpha channel (3) is left untouched.
    for (let c = 0; c < 3 && byteIdx < fullPayload.length; c++) {
      let channelVal = data[pixelOffset + c];

      // Extract validBitsPerChannel bits from payload
      let extractedBits = 0;
      for (let b = 0; b < validBitsPerChannel && byteIdx < fullPayload.length; b++) {
        const bit = (fullPayload[byteIdx] >>> bitShift) & 1;
        extractedBits = (extractedBits << 1) | bit;

        bitShift--;
        if (bitShift < 0) {
          bitShift = 7;
          byteIdx++;
        }
      }

      // Replace LSBs of channel
      channelVal = (channelVal & mask) | extractedBits;
      data[pixelOffset + c] = channelVal;
    }
  }

  return imageData;
}

/**
 * Extracts payload from ImageData LSB.
 * Auto-detects bitsPerChannel from STGV versioned header if present, or falls back to forcedBitsPerChannel.
 */
export function extractPayloadFromImageData(
  imageData: ImageData,
  forcedBitsPerChannel = 1
): Uint8Array {
  // Attempt extraction across candidate bit depths (1 to 4) to detect versioned STGV header
  const candidateDepths = [forcedBitsPerChannel, 1, 2, 3, 4].filter(
    (val, idx, self) => self.indexOf(val) === idx
  );

  for (const depth of candidateDepths) {
    try {
      const extracted = extractPayloadInternal(imageData, depth);
      if (extracted) return extracted;
    } catch {
      // Continue testing next depth candidate
    }
  }

  throw new Error('No valid steganographic payload found in image LSB. Passphrase may be incorrect or image is unencoded.');
}

function extractPayloadInternal(imageData: ImageData, bitsPerChannel: number): Uint8Array | null {
  const data = imageData.data;
  const totalPixels = imageData.width * imageData.height;

  let currentByte = 0;
  let bitCount = 0;

  const headerBytes = new Uint8Array(HEADER_SIZE);
  let headerByteIdx = 0;

  let payload: Uint8Array | null = null;
  let payloadByteIdx = 0;
  let expectedLength = 0;
  let isVersionedHeader = false;

  for (let p = 0; p < totalPixels; p++) {
    const pixelOffset = p * 4;

    for (let c = 0; c < 3; c++) {
      const channelVal = data[pixelOffset + c];

      for (let b = bitsPerChannel - 1; b >= 0; b--) {
        const bit = (channelVal >>> b) & 1;
        currentByte = (currentByte << 1) | bit;
        bitCount++;

        if (bitCount === 8) {
          if (headerByteIdx < HEADER_SIZE) {
            headerBytes[headerByteIdx] = currentByte;
            headerByteIdx++;

            // After reading first 4 bytes, test for "STGV" magic
            if (headerByteIdx === 4) {
              if (
                headerBytes[0] === STGV_MAGIC[0] &&
                headerBytes[1] === STGV_MAGIC[1] &&
                headerBytes[2] === STGV_MAGIC[2] &&
                headerBytes[3] === STGV_MAGIC[3]
              ) {
                isVersionedHeader = true;
              } else if (bitsPerChannel !== 1) {
                // Not versioned and non-1-bit: legacy header was only 4 bytes uint32 length
                expectedLength =
                  (headerBytes[0] << 24) |
                  (headerBytes[1] << 16) |
                  (headerBytes[2] << 8) |
                  headerBytes[3];

                const maxCap = calculateImageCapacity(imageData.width, imageData.height, bitsPerChannel);
                if (expectedLength > 0 && expectedLength <= maxCap) {
                  payload = new Uint8Array(expectedLength);
                  headerByteIdx = HEADER_SIZE; // Skip remaining versioned header read
                } else {
                  return null;
                }
              }
            }

            if (isVersionedHeader && headerByteIdx === HEADER_SIZE) {
              const headerBitsDepth = headerBytes[5]; // Encoded bitsPerChannel
              if (headerBitsDepth !== bitsPerChannel) {
                // If the encoded bitsPerChannel differs from current pass depth, return null to let caller retry with headerBitsDepth
                return null;
              }

              expectedLength =
                (headerBytes[8] << 24) |
                (headerBytes[9] << 16) |
                (headerBytes[10] << 8) |
                headerBytes[11];

              const maxCap = calculateImageCapacity(imageData.width, imageData.height, bitsPerChannel);
              if (expectedLength <= 0 || expectedLength > maxCap) {
                return null;
              }

              payload = new Uint8Array(expectedLength);
            } else if (!isVersionedHeader && headerByteIdx === 4 && bitsPerChannel === 1) {
              // Legacy 4-byte header fallback for 1-bit LSB
              expectedLength =
                (headerBytes[0] << 24) |
                (headerBytes[1] << 16) |
                (headerBytes[2] << 8) |
                headerBytes[3];

              const maxCap = calculateImageCapacity(imageData.width, imageData.height, bitsPerChannel);
              if (expectedLength > 0 && expectedLength <= maxCap) {
                payload = new Uint8Array(expectedLength);
                headerByteIdx = HEADER_SIZE; // Jump to payload read
              } else {
                return null;
              }
            }
          } else if (payload && payloadByteIdx < expectedLength) {
            payload[payloadByteIdx] = currentByte;
            payloadByteIdx++;

            if (payloadByteIdx === expectedLength) {
              return payload;
            }
          }

          currentByte = 0;
          bitCount = 0;
        }
      }
    }
  }

  if (payload && payloadByteIdx === expectedLength) {
    return payload;
  }

  return null;
}

/**
 * Generates an ImageData rendering of a specific bitplane (0 = LSB, 7 = MSB)
 * for visual steganalysis.
 */
export function renderBitplane(
  sourceData: ImageData,
  bitIndex: number, // 0 to 7
  channel: 'all' | 'red' | 'green' | 'blue' | 'alpha' | 'luminance'
): ImageData {
  const width = sourceData.width;
  const height = sourceData.height;
  const src = sourceData.data;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const outData = ctx.createImageData(width, height);
  const dst = outData.data;

  const totalPixels = width * height;

  for (let i = 0; i < totalPixels; i++) {
    const srcIdx = i * 4;
    const dstIdx = i * 4;

    const r = src[srcIdx];
    const g = src[srcIdx + 1];
    const b = src[srcIdx + 2];
    const a = src[srcIdx + 3];

    let val = 0;

    if (channel === 'red') {
      val = ((r >>> bitIndex) & 1) * 255;
    } else if (channel === 'green') {
      val = ((g >>> bitIndex) & 1) * 255;
    } else if (channel === 'blue') {
      val = ((b >>> bitIndex) & 1) * 255;
    } else if (channel === 'alpha') {
      val = ((a >>> bitIndex) & 1) * 255;
    } else if (channel === 'luminance') {
      const lum = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      val = ((lum >>> bitIndex) & 1) * 255;
    } else {
      // Composite RGB
      const rBit = (r >>> bitIndex) & 1;
      const gBit = (g >>> bitIndex) & 1;
      const bBit = (b >>> bitIndex) & 1;
      dst[dstIdx] = rBit * 255;
      dst[dstIdx + 1] = gBit * 255;
      dst[dstIdx + 2] = bBit * 255;
      dst[dstIdx + 3] = 255;
      continue;
    }

    dst[dstIdx] = val;
    dst[dstIdx + 1] = val;
    dst[dstIdx + 2] = val;
    dst[dstIdx + 3] = 255;
  }

  return outData;
}

/**
 * Log-Gamma function via Stirling approximation
 */
function lngamma(z: number): number {
  const c = [
    76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5,
  ];
  let x = z;
  let y = z;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += c[j] / ++y;
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

/**
 * Regularized lower incomplete gamma function P(a, x)
 */
function gammaP(a: number, x: number): number {
  if (x <= 0) return 0;
  if (x > a + 1) return 1 - gammaQ(a, x);
  let sum = 1 / a;
  let term = sum;
  for (let n = 1; n < 100; n++) {
    term *= x / (a + n);
    sum += term;
    if (Math.abs(term) < Math.abs(sum) * 1e-12) break;
  }
  return Math.min(1.0, Math.max(0.0, sum * Math.exp(-x + a * Math.log(x) - lngamma(a))));
}

/**
 * Regularized upper incomplete gamma function Q(a, x)
 */
function gammaQ(a: number, x: number): number {
  if (x <= 0) return 1.0;
  if (x < a + 1) return 1 - gammaP(a, x);
  let b = x + 1 - a;
  let c = 1 / 1e-30;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 100; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = b + an / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-12) break;
  }
  return Math.min(1.0, Math.max(0.0, Math.exp(-x + a * Math.log(x) - lngamma(a)) * h));
}

/**
 * Calculates exact Chi-Square test statistics and mathematical p-value on image LSBs
 * to evaluate statistical likelihood of steganographic payload.
 */
export function analyzeImageSteganography(imageData: ImageData): ForensicResult {
  const data = imageData.data;
  const totalPixels = imageData.width * imageData.height;

  // Pair-of-Values (PoVs) for LSB distribution analysis across 128 intensity pairs
  const povCounts = new Array(128).fill(0).map(() => [0, 0]);

  let lsbOnes = 0;
  let totalLsbBits = 0;

  for (let i = 0; i < totalPixels; i++) {
    const pixelOffset = i * 4;
    for (let c = 0; c < 3; c++) {
      const val = data[pixelOffset + c];
      const lsb = val & 1;

      if (lsb === 1) lsbOnes++;
      totalLsbBits++;

      const pairIdx = Math.floor(val / 2);
      povCounts[pairIdx][lsb]++;
    }
  }

  const lsbNoiseRatio = totalLsbBits > 0 ? lsbOnes / totalLsbBits : 0.5;

  let chiSquare = 0;
  let degreesOfFreedom = 0;

  for (let i = 0; i < 128; i++) {
    const countEven = povCounts[i][0];
    const countOdd = povCounts[i][1];
    const sum = countEven + countOdd;

    if (sum > 5) {
      const expected = sum / 2;
      chiSquare += Math.pow(countEven - expected, 2) / expected;
      chiSquare += Math.pow(countOdd - expected, 2) / expected;
      degreesOfFreedom++;
    }
  }

  // Exact Chi-Square upper-tail p-value P(X >= chiSquare)
  const df = Math.max(1, degreesOfFreedom);
  const pValue = gammaQ(df / 2, chiSquare / 2);

  // Heuristic suspicion rating based on p-value and LSB noise ratio
  // High p-value (pValue close to 1.0) indicates that even/odd pairs are unnaturally equalized (LSB stego signature)
  let suspicionScore = 0;

  if (pValue > 0.95) {
    suspicionScore = Math.round(pValue * 100);
  } else if (pValue > 0.5) {
    suspicionScore = Math.round(pValue * 60);
  } else {
    suspicionScore = Math.round((chiSquare / df < 1.2 ? 15 : 5));
  }

  // Factor LSB ratio close to 0.500
  if (Math.abs(lsbNoiseRatio - 0.5) < 0.005 && suspicionScore > 30) {
    suspicionScore = Math.min(99, suspicionScore + 15);
  }

  let verdict: 'clean' | 'suspicious' | 'high_statistical_anomaly' = 'clean';
  let details = 'Image exhibits normal natural pixel variance. No obvious statistical LSB steganography signature detected.';

  if (suspicionScore > 75) {
    verdict = 'high_statistical_anomaly';
    details = 'High statistical anomaly detected in LSB distribution. Color intensity pairs exhibit artificial uniformity typical of LSB payload embedding.';
  } else if (suspicionScore > 35) {
    verdict = 'suspicious';
    details = 'Moderate LSB uniformity detected. Image exhibits subtle statistical noise variance or high-frequency filtering artifacts.';
  }

  // Calculate Shannon entropy of LSB plane
  const p1 = Math.max(1e-10, Math.min(1 - 1e-10, lsbNoiseRatio));
  const p0 = 1 - p1;
  const entropy = -(p0 * Math.log2(p0) + p1 * Math.log2(p1));

  return {
    entropy,
    chiSquarePValue: pValue,
    lsbNoiseRatio,
    suspicionScore,
    verdict,
    details,
  };
}

/**
 * Computes a visual difference heatmap between cover ImageData and stego ImageData.
 */
export function generateDifferenceHeatmap(original: ImageData, stego: ImageData): ImageData {
  const width = original.width;
  const height = original.height;
  const origData = original.data;
  const stegoData = stego.data;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const diffData = ctx.createImageData(width, height);
  const dst = diffData.data;

  const totalPixels = width * height;

  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4;

    const rDiff = Math.abs(origData[idx] - stegoData[idx]);
    const gDiff = Math.abs(origData[idx + 1] - stegoData[idx + 1]);
    const bDiff = Math.abs(origData[idx + 2] - stegoData[idx + 2]);

    const totalDiff = rDiff + gDiff + bDiff;

    if (totalDiff > 0) {
      // Highlight modified pixels with vivid gold/crimson
      dst[idx] = 236; // Red
      dst[idx + 1] = 168; // Green
      dst[idx + 2] = 76; // Blue
      dst[idx + 3] = 255;
    } else {
      // Unchanged pixels dimmed dark obsidian
      dst[idx] = 18;
      dst[idx + 1] = 20;
      dst[idx + 2] = 23;
      dst[idx + 3] = 255;
    }
  }

  return diffData;
}
