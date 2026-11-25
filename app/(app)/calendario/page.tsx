import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { requireMember } from '@/lib/auth'
import { money } from '@/lib/format'
import { FixtureRow } from '@/components/fixture-row'
import { RoundStatus } from '@/components/round-status'

export const metadata: Metadata = { title: 'Calendario' }

export default async function CalendarPage() {
  const { supabase } = await requireMember()
  const { data: rounds } = await supabase
    .from('rounds')
    .select(
      'id, name, number, status, fixtures(id, club, competition, home_team, away_team, kickoff_at, status, home_goals, away_goals), round_settlements(winners_count, share_cents, pot_after_cents), round_winners(profiles(display_name))',
    )
    .neq('status', 'draft')
    .order('number', { ascending: false })

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-2xl font-semibold">Calendario</h1>
        <p className="mt-1 text-sm text-ivory-muted">Todas las jornadas, sus partidos y quién se llevó el bote.</p>
      </header>

      {(rounds ?? []).length === 0 && (
        <p className="rounded-2xl border border-dashed border-line px-5 py-8 text-center text-sm text-ivory-muted">
          Todavía no se ha publicado ninguna jornada.
        </p>
      )}

      {(rounds ?? []).map((r) => {
        const fixtures = [...(r.fixtures ?? [])].sort((a, b) => a.kickoff_at.localeCompare(b.kickoff_at))
        const s = Array.isArray(r.round_settlements) ? r.round_settlements[0] : r.round_settlements
        const winners = (r.round_winners ?? []).map((w) => w.profiles?.display_name).filter(Boolean)
        return (
          <section key={r.id} aria-labelledby={`r-${r.id}`} className="space-y-2">
            <Link href={`/calendario/${r.id}`} className="flex items-center gap-2">
              <h2 id={`r-${r.id}`} className="font-display text-lg font-semibold">
                {r.name}
              </h2>
              <RoundStatus status={r.status} />
              <span className="ml-auto flex items-center text-sm text-gold-bright">
                Detalle <ChevronRight size={16} aria-hidden />
              </span>
            </Link>
            {fixtures.map((f) => (
              <FixtureRow key={f.id} fixture={f} />
            ))}
            {s && r.status === 'settled' && (
              <p className="px-1 text-sm text-ivory-muted">
                {s.winners_count > 0 ? (
                  <>
                    Ganó <strong className="text-gold-bright">{winners.join(', ')}</strong>: {money(s.share_cents)}
                    {s.winners_count > 1 ? ' cada uno' : ''}.
                  </>
                ) : (
                  <>Nadie acertó los dos. El bote se acumula: {money(s.pot_after_cents)}.</>
                )}
              </p>
            )}
            {r.status === 'void' && <p className="px-1 text-sm text-ivory-muted">Jornada anulada. Los boletos sumaron al bote.</p>}
          </section>
        )
      })}
    </div>
  )
}
