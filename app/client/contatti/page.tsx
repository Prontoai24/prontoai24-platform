import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import ContactsWorkspace from '@/components/client/ContactsWorkspace'

export const dynamic = 'force-dynamic'

export default function ContactsPage() {
  return <main className="min-h-screen bg-[#f7fbff]"><header className="flex items-center justify-between border-b border-[var(--line)] bg-white px-5 py-4 lg:px-8"><Link href="/client" className="flex items-center gap-3 text-sm font-bold text-[var(--muted)] hover:text-[var(--ink)]"><ArrowLeft size={17} /> Dashboard cliente</Link><span className="font-bold">ProntoAI<span className="text-[var(--cyan)]">24</span> <span className="ml-2 text-sm font-medium text-[var(--muted)]">Contatti e Liste</span></span></header><ContactsWorkspace /></main>
}
