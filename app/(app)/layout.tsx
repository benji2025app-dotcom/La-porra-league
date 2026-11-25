import Image from 'next/image'
import Link from 'next/link'
import { BottomNav } from '@/components/bottom-nav'
import { requireMember } from '@/lib/auth'

export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const { profile } = await requireMember()

  return (
    <div className="min-h-dvh pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-20 bg-carbon/88 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-xl items-center justify-between px-5">
          <Link href="/" aria-label="La Porra League, inicio" className="block">
            <Image src="/brand/wordmark-sm.png" alt="" width={159} height={120} priority className="h-11 w-auto" />
          </Link>
          <Link
            href="/perfil"
            className="flex items-center gap-2 rounded-full border border-line bg-carbon-2 py-1.5 pl-1.5 pr-3.5 text-sm hover:border-gold/60"
          >
            <span
              aria-hidden
              className="grid size-7 place-items-center rounded-full bg-gradient-to-b from-gold-bright to-gold-deep font-display text-[0.8rem] font-bold text-carbon"
            >
              {profile.display_name.slice(0, 1).toUpperCase()}
            </span>
            <span className="max-w-[9rem] truncate">{profile.display_name}</span>
          </Link>
        </div>
        <div className="club-ribbon mx-auto max-w-xl" />
      </header>

      <main className="mx-auto w-full max-w-xl px-5 pt-6">{children}</main>
      <BottomNav />
    </div>
  )
}
