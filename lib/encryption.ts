import crypto from 'crypto';

if (!process.env.GIFT_CARD_SECRET || process.env.GIFT_CARD_SECRET.length !== 64) {
  throw new Error('FATAL: GIFT_CARD_SECRET must be exactly a 64-character hex string');
}

const ALGORITHM = 'aes-256-gcm';
const SECRET_KEY = Buffer.from(process.env.GIFT_CARD_SECRET, 'hex');

export function encryptGiftCard(text: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, SECRET_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decryptGiftCard(encryptedText: string): string {
  const parts = encryptedText.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted format');
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];
  
  const decipher = crypto.createDecipheriv(ALGORITHM, SECRET_KEY, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}