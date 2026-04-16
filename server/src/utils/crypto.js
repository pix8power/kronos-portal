const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const PREFIX = 'enc:';

function getKey() {
  const key = process.env.MESSAGE_ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new Error('MESSAGE_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
  }
  return Buffer.from(key, 'hex');
}

/**
 * Encrypts a plaintext string.
 * Returns a string in the format: enc:<iv_hex>:<authTag_hex>:<ciphertext_hex>
 */
function encrypt(plaintext) {
  const key = getKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypts a string produced by encrypt().
 * If the value doesn't start with the enc: prefix (legacy plaintext), returns it as-is.
 */
function decrypt(ciphertext) {
  if (!ciphertext || !ciphertext.startsWith(PREFIX)) return ciphertext;
  try {
    const [ivHex, authTagHex, encHex] = ciphertext.slice(PREFIX.length).split(':');
    const key = getKey();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    return decipher.update(Buffer.from(encHex, 'hex'), undefined, 'utf8') + decipher.final('utf8');
  } catch {
    return '[encrypted message]';
  }
}

module.exports = { encrypt, decrypt };
