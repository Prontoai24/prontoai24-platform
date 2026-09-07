#!/usr/bin/env node

const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3000'
const cookie = process.env.TEST_AUTH_COOKIE
const filePath = process.argv[2]

const unauthenticated = await fetch(`${baseUrl}/api/admin/plans/import`, { method: 'POST' })
if (unauthenticated.status !== 401) throw new Error(`Smoke auth fallito: atteso 401, ricevuto ${unauthenticated.status}`)
console.log('OK: endpoint protetto, richiesta anonima respinta con 401')

if (!cookie) {
  console.log('SKIP: TEST_AUTH_COOKIE non impostato; import autenticato non eseguito')
  process.exit(0)
}
if (!filePath) throw new Error('Per il test autenticato indica il percorso del PDF: node scripts/test-pricing-pdf-import.mjs ./listino.pdf')

const file = new Blob([await (await import('node:fs/promises')).readFile(filePath)], { type: 'application/pdf' })
const form = new FormData()
form.set('file', file, 'listino.pdf')
const response = await fetch(`${baseUrl}/api/admin/plans/import`, { method: 'POST', headers: { Cookie: cookie }, body: form })
const body = await response.json().catch(() => ({}))
if (!response.ok) throw new Error(`Import PDF fallito (${response.status}): ${body.error || 'errore sconosciuto'}`)
if (!Number.isInteger(body.imported) || body.imported < 1) throw new Error('Import PDF senza righe riconosciute')
console.log(`OK: import autenticato completato, righe importate: ${body.imported}`)
