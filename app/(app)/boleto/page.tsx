import { serverNow } from '@/lib/time'
import type { Metadata } from 'next'
import Link from 'next/link'
import { requireMember } from '@/lib/auth'
import { kickoff } from '@/lib/format'
import { CLUB_EDGE, CLUB_NAME } from '@/components/fixture-row'
import { MatchPicker } from './match-picker'

export const metadata: Metadata = { title: 'Mi boleto' }

export default async function TicketPage() {
  const { supabase, user } = await requireMember()
  const { data: round } = await supabase
    .from('rounds')
    .select('id, name, fixtures(id, club, competition, home_team, away_team, kickoff_at, status, locked_at, home_goals, away_goals)')
    .eq('status', 'open')
    .order('number', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!round) {
    return (
      <section className="space-y-3">
        <h1 className="font-display text-2xl font-semibold">Mi boleto</h1>
        <p className="rounded-2xl border border-dashed border-line px-5 py-8 text-center text-sm text-ivory-muted">
          No hay jornada abierta ahora mismo. Revisa el{' '}
          <Link href="/calendario" className="font-semibold text-gold-bright underline-offset-4 hover:underline">
            calendario
          </Link>{' '}
          para ver resultados y ganadores.
        </p>
      </section>
    )
  }

  const order = { barcelona: 0, real_madrid: 1 } as const
  const fixtures = [...(round.fixtures ?? [])].sort((a, b) => order[a.club] - order[b.club])
  const ids = fixtures.map((f) => f.id)
  const { data: predictions } = await supabase
    .from('predictions')
    .select('fixture_id, user_id, home_goals, away_goals, profiles(display_name)')
    .in('fixture_id', ids)

  const now = serverNow()
  const isLocked = (f: (typeof fixtures)[number]) =>
    f.locked_at !== null || new Date(f.kickoff_at).getTime() <= now || f.status === 'live' || f.status === 'finished'

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold">Mi boleto</h1>
        <p className="mt-1 text-sm text-ivory-muted">{round.name}. Acierta los dos marcadores exactos para llevarte el bote.</p>
      </header>

      {/* El boleto: dos partidos separados por una línea troquelada */}
      <section aria-label={`Boleto de la ${round.name}`} className="gold-frame">
        {fixtures.map((f, i) => {
          const mine = (predictions ?? []).find((p) => p.fixture_id === f.id && p.user_id === user.id)
          return (
            <div key={f.id}>
              {i > 0 && (
                <div aria-hidden className="relative h-0">
                  <span className="absolute -left-[11px] -top-[11px] size-[22px] rounded-full border border-gold/60 bg-carbon [clip-path:inset(0_0_0_50%)]" />
                  <span className="absolute -right-[11px] -top-[11px] size-[22px] rounded-full border border-gold/60 bg-carbon [clip-path:inset(0_50%_0_0)]" />
                  <span className="absolute inset-x-5 top-0 border-t-2 border-dashed border-line" />
                </div>
              )}
              <div className="relative px-5 pb-5 pt-5">
                <div className="mb-4 flex items-center gap-2">
                  <span aria-hidden className={`h-4 w-1 rounded-full ${CLUB_EDGE[f.club]}`} />
                  <span className="text-sm font-semibold">{CLUB_NAME[f.club]}</span>
                  <span className="ml-auto text-right text-xs text-ivory-muted">
                    {f.competition}
                    <br />
                    {kickoff(f.kickoff_at)}
                  </span>
                </div>
                {isLocked(f) && (
                  <p className="mb-2 text-sm">
                    {f.home_team} <span className="text-ivory-muted">vs</span> {f.away_team}
                  </p>
                )}
                {f.status === 'postponed' && !isLocked(f) ? (
                  <p className="text-sm text-danger">Partido aplazado. El administrador indicará qué se hace con él.</p>
                ) : (
                  <MatchPicker
                    fixtureId={f.id}
                    homeTeam={f.home_team}
                    awayTeam={f.away_team}
                    kickoffAt={f.kickoff_at}
                    lockedAtLoad={isLocked(f)}
                    saved={mine ? { home: mine.home_goals, away: mine.away_goals } : null}
                  />
                )}
              </div>
            </div>
          )
        })}
      </section>

      {fixtures.some(isLocked) && (
        <section className="space-y-4">
          <h2 className="font-display text-lg font-semibold">Pronósticos del grupo</h2>
          {fixtures.filter(isLocked).map((f) => {
            const list = (predictions ?? []).filter((p) => p.fixture_id === f.id)
            return (
              <div key={f.id}>
                <p className="mb-2 text-sm text-ivory-muted">
                  {f.home_team} vs {f.away_team}
                  {f.status === 'finished' && (
                    <span className="ml-2 font-display font-bold text-gold-bright">
                      {f.home_goals}–{f.away_goals}
                    </span>
                  )}
                </p>
                <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-carbon-2 text-sm">
                  {list.length === 0 && <li className="px-4 py-3 text-ivory-muted">Nadie pronosticó este partido.</li>}
                  {list.map((p) => {
                    const hit = f.status === 'finished' && p.home_goals === f.home_goals && p.away_goals === f.away_goals
                    return (
                      <li key={p.user_id} className="flex justify-between px-4 py-2.5">
                        <span className={p.user_id === user.id ? 'font-semibold' : ''}>{p.profiles?.display_name}</span>
                        <span className={`font-display font-bold tabular-nums ${hit ? 'text-ok' : ''}`}>
                          {p.home_goals}–{p.away_goals}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </section>
      )}
    </div>
  )
}
