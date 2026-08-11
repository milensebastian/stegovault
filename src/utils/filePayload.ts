/**
 * File & Text Payload Packing Utilities
 * Serializes and deserializes structured payloads containing versioning, payload type,
 * filename, MIME type, and binary file data.
 */

export interface StructuredPayload {
  version: number;
  type: 'text' | 'file';
  text?: string;
  filename?: string;
  mimeType?: string;
  fileData?: Uint8Array;
}

const PAYLOAD_MAGIC_BYTE = 0x02; // Version 2 structured payload format

/**
 * Packs text or file into a structured binary byte array.
 */
export function packStructuredPayload(
  type: 'text' | 'file',
  content: { text?: string; filename?: string; mimeType?: string; fileData?: Uint8Array }
): Uint8Array {
  const encoder = new TextEncoder();

  if (type === 'text') {
    const textBytes = encoder.encode(content.text || '');
    const packed = new Uint8Array(1 + 1 + 4 + textBytes.length);
    packed[0] = PAYLOAD_MAGIC_BYTE;
    packed[1] = 0x00; // Text payload
    packed[2] = (textBytes.length >>> 24) & 0xff;
    packed[3] = (textBytes.length >>> 16) & 0xff;
    packed[4] = (textBytes.length >>> 8) & 0xff;
    packed[5] = textBytes.length & 0xff;
    packed.set(textBytes, 6);
    return packed;
  } else {
    const fnBytes = encoder.encode(content.filename || 'secret-file.bin');
    const mimeBytes = encoder.encode(content.mimeType || 'application/octet-stream');
    const dataBytes = content.fileData || new Uint8Array(0);

    const fnLen = Math.min(65535, fnBytes.length);
    const mimeLen = Math.min(65535, mimeBytes.length);
    const dataLen = dataBytes.length;

    // Header size: 1 (magic) + 1 (type=1) + 2 (fnLen) + fnLen + 2 (mimeLen) + mimeLen + 4 (dataLen)
    const headerSize = 1 + 1 + 2 + fnLen + 2 + mimeLen + 4;
    const packed = new Uint8Array(headerSize + dataLen);

    let offset = 0;
    packed[offset++] = PAYLOAD_MAGIC_BYTE;
    packed[offset++] = 0x01; // File payload

    // Filename
    packed[offset++] = (fnLen >>> 8) & 0xff;
    packed[offset++] = fnLen & 0xff;
    packed.set(fnBytes.subarray(0, fnLen), offset);
    offset += fnLen;

    // MIME type
    packed[offset++] = (mimeLen >>> 8) & 0xff;
    packed[offset++] = mimeLen & 0xff;
    packed.set(mimeBytes.subarray(0, mimeLen), offset);
    offset += mimeLen;

    // File Data Length
    packed[offset++] = (dataLen >>> 24) & 0xff;
    packed[offset++] = (dataLen >>> 16) & 0xff;
    packed[offset++] = (dataLen >>> 8) & 0xff;
    packed[offset++] = dataLen & 0xff;

    // File Data
    packed.set(dataBytes, offset);

    return packed;
  }
}

/**
 * Unpacks binary data into structured payload. Supports fallback for legacy formats.
 */
export function unpackStructuredPayload(bytes: Uint8Array): StructuredPayload {
  if (!bytes || bytes.length === 0) {
    return { version: 0, type: 'text', text: '' };
  }

  // Check structured version 2 magic byte
  if (bytes[0] === PAYLOAD_MAGIC_BYTE && bytes.length >= 6) {
    const pType = bytes[1];
    if (pType === 0x00) {
      // Plain text
      const txtLen = (bytes[2] << 24) | (bytes[3] << 16) | (bytes[4] << 8) | bytes[5];
      if (txtLen >= 0 && bytes.length >= 6 + txtLen) {
        const textStr = new TextDecoder('utf-8', { fatal: false }).decode(bytes.subarray(6, 6 + txtLen));
        return { version: 2, type: 'text', text: textStr };
      }
    } else if (pType === 0x01) {
      // File payload
      try {
        let offset = 2;
        if (bytes.length < offset + 2) throw new Error();
        const fnLen = (bytes[offset] << 8) | bytes[offset + 1];
        offset += 2;

        if (bytes.length < offset + fnLen + 2) throw new Error();
        const filename = new TextDecoder('utf-8').decode(bytes.subarray(offset, offset + fnLen));
        offset += fnLen;

        const mimeLen = (bytes[offset] << 8) | bytes[offset + 1];
        offset += 2;

        if (bytes.length < offset + mimeLen + 4) throw new Error();
        const mimeType = new TextDecoder('utf-8').decode(bytes.subarray(offset, offset + mimeLen));
        offset += mimeLen;

        const dataLen = (bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];
        offset += 4;

        if (bytes.length >= offset + dataLen) {
          const fileData = bytes.subarray(offset, offset + dataLen);
          return {
            version: 2,
            type: 'file',
            filename,
            mimeType,
            fileData,
          };
        }
      } catch {
        // Fall back to legacy parsing
      }
    }
  }

  // Legacy fallback 1: Check 2-byte filename length format used in earlier version
  if (bytes.length > 2) {
    const fnLen = (bytes[0] << 8) | bytes[1];
    if (fnLen > 0 && fnLen < 256 && bytes.length > 2 + fnLen) {
      try {
        const filename = new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(2, 2 + fnLen));
        const fileData = bytes.subarray(2 + fnLen);
        return {
          version: 1,
          type: 'file',
          filename,
          mimeType: 'application/octet-stream',
          fileData,
        };
      } catch {
        // Ignore and fallback
      }
    }
  }

  // Legacy fallback 2: Standard UTF-8 text string
  const textStr = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  return { version: 1, type: 'text', text: textStr };
}
