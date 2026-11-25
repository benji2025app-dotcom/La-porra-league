import { serverNow } from '@/lib/time'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Lock } from 'lucide-react'
import { requireMember } from '@/lib/auth'
import { money } from '@/lib/format'
import { FixtureRow } from '@/components/fixture-row'
import { RoundStatus } from '@/components/round-status'

export const metadata: Metadata = { title: 'Jornada' }

export default async function RoundDetailPage({ params }: PageProps<'/calendario/[id]'>) {
  const { id } = await params
  const { supabase, user } = await requireMember()
  const { data: round } = await supabase
    .from('rounds')
    .select(
      'id, name, status, fixtures(id, club, competition, home_team, away_team, kickoff_at, status, locked_at, home_goals, away_goals), round_settlements(*), round_winners(user_id, share_cents)',
    )
    .eq('id', id)
    .neq('status', 'draft')
    .maybeSingle()
  if (!round) notFound()

  const order = { barcelona: 0, real_madrid: 1 } as const
  const fixtures = [...(round.fixtures ?? [])].sort((a, b) => order[a.club] - order[b.club])
  const settlement = Array.isArray(round.round_settlements) ? round.round_settlements[0] : round.round_settlements
  const winnerIds = new Set((round.round_winners ?? []).map((w) => w.user_id))

  // RLS solo devuelve los pronósticos ajenos de partidos ya empezados.
  const { data: predictions } = await supabase
    .from('predictions')
    .select('fixture_id, user_id, home_goals, away_goals, profiles(display_name)')
    .in(
      'fixture_id',
      fixtures.map((f) => f.id),
    )

  const players = new Map<string, string>()
  for (const p of predictions ?? []) players.set(p.user_id, p.profiles?.display_name ?? 'Jugador')
  const rows = [...players.entries()].sort((a, b) => Number(winnerIds.has(b[0])) - Number(winnerIds.has(a[0])) || a[1].localeCompare(b[1]))
  const now = serverNow()
  const revealed = (f: (typeof fixtures)[number]) => f.locked_at !== null || new Date(f.kickoff_at).getTime() <= now || f.status === 'finished'

  return (
    <div className="space-y-6">
      <header>
        <Link href="/calendario" className="text-sm text-ivory-muted hover:text-ivory">
          Calendario
        </Link>
        <div className="flex items-center gap-2">
          <h1 className="font-display text-2xl font-semibold">{round.name}</h1>
          <RoundStatus status={round.status} />
        </div>
      </header>

      <div className="space-y-2">
        {fixtures.map((f) => (
          <FixtureRow key={f.id} fixture={f} />
        ))}
      </div>

      {settlement && (
        <section className="gold-frame px-5 py-4 text-sm">
          {settlement.kind === 'void' ? (
            <p>
              Jornada anulada{settlement.reason ? `: ${settlement.reason}` : ''}. {settlement.participants_count} boletos sumaron{' '}
              {money(settlement.contribution_total_cents)} al bote.
            </p>
          ) : settlement.winners_count > 0 ? (
            <p>
              Bote en juego {money(settlement.pot_in_play_cents)}.{' '}
              <strong className="text-gold-bright">
                {settlement.winners_count === 1 ? 'Un ganador' : `${settlement.winners_count} ganadores`} con {money(settlement.share_cents)}
                {settlement.winners_count > 1 ? ' cada uno' : ''}.
              </strong>
            </p>
          ) : (
            <p>
              Bote en juego {money(settlement.pot_in_play_cents)}. Nadie acertó los dos marcadores: pasa entero a la siguiente jornada.
            </p>
          )}
        </section>
      )}

      <section>
        <h2 className="font-display text-lg font-semibold">Pronósticos</h2>
        {fixtures.some((f) => !revealed(f)) && (
          <p className="mt-1 flex items-center gap-1.5 text-xs text-ivory-muted">
            <Lock size={12} aria-hidden /> Los de los demás se ven al empezar cada partido.
          </p>
        )}
        {rows.length === 0 ? (
          <p className="mt-3 text-sm text-ivory-muted">Aún no hay pronósticos visibles.</p>
        ) : (
          <table className="mt-3 w-full overflow-hidden rounded-2xl border border-line bg-carbon-2 text-sm">
            <caption className="sr-only">Pronósticos de cada jugador</caption>
            <thead className="text-xs text-ivory-muted">
              <tr className="border-b border-line">
                <th scope="col" className="py-2.5 pl-4 text-left font-medium">Jugador</th>
                {fixtures.map((f) => (
                  <th key={f.id} scope="col" className="py-2.5 pr-4 text-right font-medium">
                    {f.club === 'barcelona' ? 'Barça' : 'Madrid'}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map(([uid, name]) => (
                <tr key={uid} className={winnerIds.has(uid) ? 'bg-gold/10' : ''}>
                  <th scope="row" className={`py-2.5 pl-4 text-left ${uid === user.id ? 'font-semibold' : 'font-normal'}`}>
                    {name}
                    {winnerIds.has(uid) && <span className="ml-2 text-xs text-gold-bright">Ganador</span>}
                  </th>
                  {fixtures.map((f) => {
                    const p = (predictions ?? []).find((x) => x.fixture_id === f.id && x.user_id === uid)
                    const hit = p && f.status === 'finished' && p.home_goals === f.home_goals && p.away_goals === f.away_goals
                    return (
                      <td key={f.id} className={`py-2.5 pr-4 text-right font-display font-bold tabular-nums ${hit ? 'text-ok' : ''}`}>
                        {p ? `${p.home_goals}–${p.away_goals}` : <span className="font-sans font-normal text-ivory-muted">·</span>}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
