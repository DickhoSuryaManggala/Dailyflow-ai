/**
 * Lightweight password-based encryption and decryption for End-to-End Encryption (E2E).
 * This runs ENTIRELY on the client so that plaintexts are never sent to the network or Firebase.
 */

// Helper to hash passwords into an integer seed
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

// Simple and stable password-based stream cipher (Vigenère/XOR with round shuffling)
export function encryptText(text: string, password?: string): string {
  if (!password || password.trim() === "" || !text) return text;
  
  const seed = hashCode(password);
  const result: string[] = [];
  
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    // Pseudo-random offset based on index and seed
    const offset = Math.floor(Math.sin(seed + i * 31) * 256) & 0xff;
    const encryptedByte = charCode ^ offset;
    
    // Convert to two-digit Hex
    const hex = encryptedByte.toString(16).padStart(2, "0");
    result.push(hex);
  }
  
  return `[E2E-AES-MOCK:${result.join("")}]`;
}

// Lightweight in-memory decryption cache partitioned by password and encrypted payload
const decryptionCache = new Map<string, string>();

export function decryptText(encryptedText: string, password?: string): string {
  if (!encryptedText || !encryptedText.startsWith("[E2E-AES-MOCK:") || !encryptedText.endsWith("]")) {
    return encryptedText; // It is not encrypted or format is normal text
  }
  
  if (!password || password.trim() === "") {
    return "🔓 [Isi Terenkripsi E2E - Masukkan Sandi untuk Melihat]";
  }

  const cacheKey = `${password}:${encryptedText}`;
  if (decryptionCache.has(cacheKey)) {
    return decryptionCache.get(cacheKey)!;
  }
  
  try {
    const hexString = encryptedText.substring(14, encryptedText.length - 1);
    const bytes: number[] = [];
    
    for (let i = 0; i < hexString.length; i += 2) {
      bytes.push(parseInt(hexString.substr(i, 2), 16));
    }
    
    const seed = hashCode(password);
    const result: string[] = [];
    
    for (let i = 0; i < bytes.length; i++) {
      const offset = Math.floor(Math.sin(seed + i * 31) * 256) & 0xff;
      const decryptedByte = bytes[i] ^ offset;
      result.push(String.fromCharCode(decryptedByte));
    }
    
    const decryptedValue = result.join("");
    decryptionCache.set(cacheKey, decryptedValue);
    return decryptedValue;
  } catch (error) {
    return "❌ Decryption Failed (Sandi Salah)";
  }
}

/**
 * Checks if a string is encrypted with our signature
 */
export function isEncrypted(text: string): boolean {
  return typeof text === "string" && text.startsWith("[E2E-AES-MOCK:") && text.endsWith("]");
}
