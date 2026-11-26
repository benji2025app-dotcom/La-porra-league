'use client'

import { usePathname } from 'next/navigation'
import { Check, ChevronDown } from 'lucide-react'
import { selectLeague } from '@/app/(app)/league-actions'
import { Crest } from '@/components/crest'
import type { League } from '@/lib/auth'

export function LeagueSwitcher({ leagues, current }: { leagues: League[]; current: League }) {
  const pathname = usePathname()
  const single = leagues.length < 2

  const label = (
    <span className="flex min-w-0 items-center gap-2">
      <span className="flex -space-x-1.5">
        <Crest team={current.club_a} size={20} />
        <Crest team={current.club_b} size={20} />
      </span>
      <span className="truncate font-display text-sm font-semibold">{current.name}</span>
    </span>
  )

  if (single) return <div className="flex items-center rounded-full border border-line bg-carbon-2 px-3 py-1.5">{label}</div>

  return (
    <details className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-full border border-line bg-carbon-2 py-1.5 pl-3 pr-2 hover:border-gold/60 [&::-webkit-details-marker]:hidden">
        {label}
        <ChevronDown size={16} aria-hidden className="text-ivory-muted transition group-open:rotate-180" />
        <span className="sr-only">Cambiar de porra</span>
      </summary>
      <div className="absolute left-0 top-full z-40 mt-2 w-64 overflow-hidden rounded-2xl border border-line bg-carbon-2 shadow-2xl shadow-black/50">
        <p className="px-4 pb-1 pt-3 text-xs text-ivory-muted">Tus porras</p>
        {leagues.map((l) => (
          <form key={l.id} action={selectLeague}>
            <input type="hidden" name="league_id" value={l.id} />
            <input type="hidden" name="next" value={pathname} />
            <button type="submit" className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-carbon-3">
              <span className="flex -space-x-1.5">
                <Crest team={l.club_a} size={22} />
                <Crest team={l.club_b} size={22} />
              </span>
              <span className="flex-1">
                <span className="block font-semibold">{l.name}</span>
                <span className="block text-xs text-ivory-muted">
                  {l.club_a.short_name ?? l.club_a.name} y {l.club_b.short_name ?? l.club_b.name}
                  {!l.is_active && ', desactivada'}
                </span>
              </span>
              {l.id === current.id && <Check size={16} aria-hidden className="text-gold-bright" />}
            </button>
          </form>
        ))}
      </div>
    </details>
  )
}
