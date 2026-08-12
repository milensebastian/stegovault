# 🔐 StegoVault

### Privacy-focused Steganography & Steganalysis Platform

StegoVault is a modern cybersecurity web application for **hiding, encrypting, extracting, and analyzing hidden information** across images, audio, and text.

It combines classical steganography techniques with modern authenticated encryption, statistical steganalysis, digital-forensics tooling, and optional AI-assisted analysis.

> **Hide it. Encrypt it. Analyze it.**

🌐 **Live Demo:** https://stegovault-two.vercel.app/

---

## ✨ Features

### 🖼️ Image Steganography

Hide text and arbitrary files inside PNG images using **LSB (Least Significant Bit) steganography**.

- 1–4 bits per channel
- Automatic bit-depth detection
- RGB channel embedding
- PNG lossless carrier support
- Capacity calculation
- Structured STGV payload format
- File and text payload support
- Corruption and capacity validation

---

### 🎵 Audio Steganography

Hide information inside uncompressed PCM WAV audio.

- 8-bit PCM support
- 16-bit PCM support
- PCM format validation
- LSB sample embedding
- Payload capacity detection
- Corrupted/truncated WAV detection
- Encrypted and unencrypted payloads

> Lossy formats such as MP3 are intentionally not used because compression can destroy LSB-embedded data.

---

### 📝 Text Steganography

Hide information inside ordinary Unicode text using zero-width characters.

Supported zero-width encoding includes:

- `U+200B` — Zero Width Space
- `U+200C` — Zero Width Non-Joiner
- `U+FEFF` — Zero Width No-Break Space / marker

The visible carrier text remains visually unchanged while the hidden payload is encoded into invisible Unicode characters.

---

## 🔐 Cryptography

StegoVault can encrypt payloads before embedding them into carriers.

### Encryption

**AES-256-GCM**

Provides:

- Confidentiality
- Integrity
- Authentication
- Tamper detection

### Key Derivation

Passwords are converted into encryption keys using:

**PBKDF2-SHA256**

with a randomly generated salt and a high iteration count.

### Cryptographic flow

```text
Password
   │
   ▼
PBKDF2-SHA256
   │
   ▼
256-bit Encryption Key
   │
   ▼
AES-256-GCM
   │
   ▼
Encrypted Payload
   │
   ▼
Steganographic Embedding
