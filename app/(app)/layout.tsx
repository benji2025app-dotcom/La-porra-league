import Image from 'next/image'
import Link from 'next/link'
import { BottomNav } from '@/components/bottom-nav'
import { LeagueSwitcher } from '@/components/league-switcher'
import { requireLeague } from '@/lib/auth'

export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const { profile, leagues, league } = await requireLeague()

  return (
    <div className="min-h-dvh pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-20 bg-carbon/88 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-xl items-center gap-3 px-5">
          <Link href="/" aria-label="La Porra League, inicio" className="block shrink-0">
            <Image src="/brand/wordmark-sm.png" alt="" width={159} height={120} priority className="h-10 w-auto" />
          </Link>
          <div className="min-w-0 flex-1">
            <LeagueSwitcher leagues={leagues} current={league} />
          </div>
          <Link
            href="/perfil"
            aria-label={`Perfil de ${profile.display_name}`}
            className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-b from-gold-bright to-gold-deep font-display text-sm font-bold text-carbon"
          >
            {profile.display_name.slice(0, 1).toUpperCase()}
          </Link>
        </div>
        <div className="club-ribbon mx-auto max-w-xl" />
      </header>

      <main className="mx-auto w-full max-w-xl px-5 pt-6">{children}</main>
      <BottomNav />
    </div>
  )
}
