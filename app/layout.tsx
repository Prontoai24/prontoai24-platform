import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://prontoai24.it'),
  title: 'ProntoAI24 — Automazioni AI che lavorano per te',
  description: 'Soluzioni AI, assistenti vocali e automazioni su misura per far crescere il tuo business.',
  openGraph: {
    title: 'ProntoAI24 — Lavorare meglio, con l’AI dalla tua parte',
    description: 'Progettiamo sistemi AI concreti per aziende che vogliono risparmiare tempo e cogliere nuove opportunità.',
    url: 'https://prontoai24.it',
    siteName: 'ProntoAI24',
    locale: 'it_IT',
    type: 'website',
  },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  )
}
