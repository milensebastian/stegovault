// Invisible Zero-Width Unicode character constants
export const ZW_ZERO = '\u200B'; // Zero-Width Space (bit 0)
export const ZW_ONE = '\u200C';  // Zero-Width Non-Joiner (bit 1)
export const ZW_DELIM = '\u200D'; // Zero-Width Joiner (delimiter)
export const ZW_MARK = '\uFEFF'; // Byte Order Mark (Start/End tag)

export interface TextStegoInspection {
  totalChars: number;
  visibleChars: number;
  hiddenZwChars: number;
  hasHiddenPayload: boolean;
  estimatedPayloadBytes: number;
}

/**
 * Encodes binary payload into Zero-Width Unicode characters.
 */
export function payloadToZeroWidth(payload: Uint8Array): string {
  let zwResult = ZW_MARK; // Start tag

  for (let i = 0; i < payload.length; i++) {
    const byte = payload[i];
    for (let bitIdx = 7; bitIdx >= 0; bitIdx--) {
      const bit = (byte >>> bitIdx) & 1;
      zwResult += bit === 0 ? ZW_ZERO : ZW_ONE;
    }
  }

  zwResult += ZW_MARK; // End tag
  return zwResult;
}

/**
 * Injects zero-width payload into cover text at natural character boundaries (e.g., spaces or linebreaks).
 */
export function embedZeroWidthInText(coverText: string, payload: Uint8Array): string {
  const zwPayload = payloadToZeroWidth(payload);

  if (!coverText || coverText.trim() === '') {
    return zwPayload;
  }

  // Insert zwPayload after first word or space
  const spaceIdx = coverText.indexOf(' ');
  if (spaceIdx !== -1) {
    return coverText.slice(0, spaceIdx + 1) + zwPayload + coverText.slice(spaceIdx + 1);
  }

  // Fallback: append to end of cover text
  return coverText + zwPayload;
}

/**
 * Extracts hidden zero-width binary payload from stego text.
 */
export function extractZeroWidthFromText(stegoText: string): Uint8Array {
  // Find payload enclosed between ZW_MARK tags or fallback to all ZW characters
  let zwString = '';
  const firstMark = stegoText.indexOf(ZW_MARK);
  const lastMark = stegoText.lastIndexOf(ZW_MARK);

  if (firstMark !== -1 && lastMark !== -1 && lastMark > firstMark) {
    zwString = stegoText.slice(firstMark + 1, lastMark);
  } else {
    // Collect all ZW_ZERO and ZW_ONE characters
    for (const char of stegoText) {
      if (char === ZW_ZERO || char === ZW_ONE) {
        zwString += char;
      }
    }
  }

  if (!zwString || zwString.length < 8) {
    throw new Error('No valid zero-width steganographic payload found in text.');
  }

  const bytes: number[] = [];
  let currentByte = 0;
  let bitCount = 0;

  for (const char of zwString) {
    if (char === ZW_ZERO) {
      currentByte = (currentByte << 1) | 0;
      bitCount++;
    } else if (char === ZW_ONE) {
      currentByte = (currentByte << 1) | 1;
      bitCount++;
    }

    if (bitCount === 8) {
      bytes.push(currentByte);
      currentByte = 0;
      bitCount = 0;
    }
  }

  if (bytes.length === 0) {
    throw new Error('Corrupted or incomplete zero-width payload.');
  }

  return new Uint8Array(bytes);
}

/**
 * Inspects text for hidden zero-width unicode characters.
 */
export function inspectTextSteganography(text: string): TextStegoInspection {
  const totalChars = text.length;
  let hiddenZwChars = 0;

  for (const char of text) {
    if (char === ZW_ZERO || char === ZW_ONE || char === ZW_DELIM || char === ZW_MARK) {
      hiddenZwChars++;
    }
  }

  const visibleChars = totalChars - hiddenZwChars;
  const estimatedPayloadBytes = Math.floor(hiddenZwChars / 8);
  const hasHiddenPayload = hiddenZwChars >= 16;

  return {
    totalChars,
    visibleChars,
    hiddenZwChars,
    hasHiddenPayload,
    estimatedPayloadBytes,
  };
}

/**
 * Returns cover text with hidden zero-width characters visually highlighted with visible markers for inspection.
 */
export function highlightInvisibleChars(text: string): { html: string; count: number } {
  let html = '';
  let count = 0;

  for (const char of text) {
    if (char === ZW_ZERO) {
      html += `<span class="bg-amber-500/30 text-amber-300 border border-amber-500/50 rounded px-1 text-xs font-mono select-none" title="Zero-Width Space [0]">[0]</span>`;
      count++;
    } else if (char === ZW_ONE) {
      html += `<span class="bg-amber-500/30 text-amber-300 border border-amber-500/50 rounded px-1 text-xs font-mono select-none" title="Zero-Width Non-Joiner [1]">[1]</span>`;
      count++;
    } else if (char === ZW_MARK) {
      html += `<span class="bg-emerald-500/30 text-emerald-300 border border-emerald-500/50 rounded px-1 text-xs font-mono select-none" title="Tag Marker">[TAG]</span>`;
      count++;
    } else if (char === ZW_DELIM) {
      html += `<span class="bg-sky-500/30 text-sky-300 border border-sky-500/50 rounded px-1 text-xs font-mono select-none" title="Delimiter">[DELIM]</span>`;
      count++;
    } else {
      // Escape HTML special characters
      if (char === '<') html += '&lt;';
      else if (char === '>') html += '&gt;';
      else if (char === '&') html += '&amp;';
      else if (char === '\n') html += '<br/>';
      else html += char;
    }
  }

  return { html, count };
}

/**
 * Default offline cover text presets
 */
export const COVER_PRESETS = [
  {
    title: 'Project Update Email',
    category: 'Corporate',
    text: `Hi Alex,\n\nFollowing up on our sprint review meeting yesterday. The backend architecture review went smoothly, and all preliminary load testing metrics look solid. Let me know if you need any additional documentation prior to Friday's deployment.\n\nBest regards,\nSarah`,
  },
  {
    title: 'Research Essay Snippet',
    category: 'Academic',
    text: `The impact of distributed consensus protocols on high-frequency trading networks remains a critical domain of study. By utilizing optimized peer-to-peer gossip algorithms, modern fault-tolerant architectures achieve sub-millisecond propagation latency without compromising system integrity.`,
  },
  {
    title: 'Culinary Recipe',
    category: 'Lifestyle',
    text: `Classic Garlic Butter Pasta:\n1. Bring a large pot of salted water to a rolling boil.\n2. Cook 250g fettuccine until al dente.\n3. In a wide skillet, melt 3 tbsp unsalted butter with 4 minced garlic cloves over low heat.\n4. Toss pasta with garlic butter, fresh parsley, and grated Parmesan.`,
  },
  {
    title: 'Open Source Readme',
    category: 'Developer',
    text: `# Project Core Engine\n\nA lightweight asynchronous task scheduler for web applications.\n\n## Features\n- Zero external dependencies\n- WebWorker pool execution\n- Automatic retry logic with exponential backoff`,
  },
];
