import crypto from 'node:crypto'

function encryptionKey() {
  const raw = process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY
  if (!raw) throw new Error('WHATSAPP_TOKEN_ENCRYPTION_KEY non configurata')
  const key = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64')
  if (key.length !== 32) throw new Error('WHATSAPP_TOKEN_ENCRYPTION_KEY deve essere una chiave AES-256 da 32 byte')
  return key
}

export function encryptWhatsAppToken(token: string) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()])
  return `v1:${iv.toString('base64url')}:${cipher.getAuthTag().toString('base64url')}:${ciphertext.toString('base64url')}`
}

export function decryptWhatsAppToken(value: string) {
  const [version, ivRaw, tagRaw, ciphertextRaw] = value.split(':')
  if (version !== 'v1' || !ivRaw || !tagRaw || !ciphertextRaw) throw new Error('Formato token WhatsApp cifrato non valido')
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivRaw, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(ciphertextRaw, 'base64url')), decipher.final()]).toString('utf8')
}
