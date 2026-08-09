import * as crypto from 'crypto';

// AES-256-GCM шифрование секретов (API-ключи, storageState hh.ru) перед записью в БД.
// Ключ из ENCRYPTION_KEY (32 байта), dev-fallback — как в .env.example.
function encryptionKey(): Buffer {
  return Buffer.from(process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef').slice(0, 32);
}

export function encryptSecret(plaintext: string | null | undefined): string | null {
  if (!plaintext) return null;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return JSON.stringify({
    iv: iv.toString('hex'),
    data: encrypted.toString('hex'),
    tag: tag.toString('hex'),
  });
}

export function decryptSecret(encoded: string | null | undefined): string | null {
  if (!encoded) return null;
  try {
    const { iv, data, tag } = JSON.parse(encoded);
    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(tag, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'hex')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}
