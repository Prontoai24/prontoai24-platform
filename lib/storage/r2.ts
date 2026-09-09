import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

function config() {
  const endpoint = process.env.R2_ENDPOINT?.trim()
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim()
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim()
  const bucket = process.env.R2_BUCKET_NAME?.trim()
  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
    const missing = [!endpoint && 'R2_ENDPOINT', !accessKeyId && 'R2_ACCESS_KEY_ID', !secretAccessKey && 'R2_SECRET_ACCESS_KEY', !bucket && 'R2_BUCKET_NAME'].filter(Boolean).join(', ')
    throw new Error(`Configurazione Cloudflare R2 incompleta: manca ${missing}`)
  }
  return { endpoint, accessKeyId, secretAccessKey, bucket }
}

function client() {
  const { endpoint, accessKeyId, secretAccessKey } = config()
  return new S3Client({ region: 'auto', endpoint, credentials: { accessKeyId, secretAccessKey } })
}

export async function createKnowledgeUploadUrl(key: string, contentType: string, expiresIn = 900) {
  const { bucket } = config()
  return getSignedUrl(client(), new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }), { expiresIn })
}

export async function getKnowledgeObject(key: string) {
  const { bucket } = config()
  const result = await client().send(new GetObjectCommand({ Bucket: bucket, Key: key }))
  if (!result.Body) throw new Error('Oggetto R2 vuoto o non trovato')
  const bytes = await result.Body.transformToByteArray()
  return { bytes, contentType: result.ContentType || 'application/octet-stream' }
}

export async function assertKnowledgeObjectExists(key: string) {
  const { bucket } = config()
  await client().send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
}

export async function putKnowledgeObject(key: string, body: Uint8Array, contentType: string) {
  const { bucket } = config()
  await client().send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }))
}
