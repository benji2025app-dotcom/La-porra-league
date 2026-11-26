import type { Metadata } from 'next'
import Link from 'next/link'
import { requireLeague } from '@/lib/auth'
import { kickoff } from '@/lib/format'
import { serverNow } from '@/lib/time'
import { FIXTURE_SELECT, byLeagueClub, clubOf, isLocked, type FixtureView } from '@/lib/queries'
import { Crest, clubEdge, clubLabel } from '@/components/crest'
import { MatchPicker } from './match-picker'

export const metadata: Metadata = { title: 'Mi boleto' }

export default async function TicketPage() {
  const { supabase, user, league, isPlayer } = await requireLeague()
  const { data: round } = await supabase
    .from('rounds')
    .select(`id, name, fixtures(${FIXTURE_SELECT})`)
    .eq('league_id', league.id)
    .eq('status', 'open')
    .order('number', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!round) {
    return (
      <section className="space-y-3">
        <h1 className="font-display text-2xl font-semibold">Mi boleto</h1>
        <p className="rounded-2xl border border-dashed border-line px-5 py-8 text-center text-sm text-ivory-muted">
          No hay jornada abierta en {league.name}. Revisa el{' '}
          <Link href="/calendario" className="font-semibold text-gold-bright underline-offset-4 hover:underline">
            calendario
          </Link>{' '}
          para ver resultados y ganadores.
        </p>
      </section>
    )
  }

  const fixtures = [...((round.fixtures ?? []) as unknown as FixtureView[])].sort(byLeagueClub(league))
  const { data: predictions } = await supabase
    .from('predictions')
    .select('fixture_id, user_id, home_goals, away_goals, profiles(display_name)')
    .in(
      'fixture_id',
      fixtures.map((f) => f.id),
    )
  const now = serverNow()

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold">Mi boleto</h1>
        <p className="mt-1 text-sm text-ivory-muted">
          {league.name}, {round.name}. Acierta los dos marcadores exactos para llevarte el bote.
        </p>
      </header>

      {!isPlayer && (
        <p className="rounded-2xl border border-line bg-carbon-2 px-4 py-3 text-sm text-ivory-muted">
          No juegas en esta porra: la ves como administrador. Puedes apuntarte desde Admin, Jugadores.
        </p>
      )}

      <section aria-label={`Boleto de la ${round.name}`} className="gold-frame">
        {fixtures.map((f, i) => {
          const club = clubOf(league, f.club_team_id)
          const mine = (predictions ?? []).find((p) => p.fixture_id === f.id && p.user_id === user.id)
          const locked = isLocked(f, now)
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
                  <span aria-hidden className="h-4 w-1 rounded-full" style={{ background: clubEdge(club.name) }} />
                  <span className="text-sm font-semibold">{clubLabel(club)}</span>
                  <span className="ml-auto text-right text-xs text-ivory-muted">
                    {f.competition}
                    <br />
                    {kickoff(f.kickoff_at)}
                  </span>
                </div>
                {(locked || !isPlayer) && (
                  <p className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                    <Crest team={f.home} name={f.home_team} size={20} /> {f.home_team} <span className="text-ivory-muted">vs</span>
                    <Crest team={f.away} name={f.away_team} size={20} /> {f.away_team}
                  </p>
                )}
                {!isPlayer ? null : f.status === 'postponed' && !locked ? (
                  <p className="text-sm text-danger">Partido aplazado. El administrador indicará qué se hace con él.</p>
                ) : (
                  <MatchPicker
                    fixtureId={f.id}
                    home={{ name: f.home_team, crest: f.home?.crest_url ?? null }}
                    away={{ name: f.away_team, crest: f.away?.crest_url ?? null }}
                    kickoffAt={f.kickoff_at}
                    lockedAtLoad={locked}
                    saved={mine ? { home: mine.home_goals, away: mine.away_goals } : null}
                  />
                )}
              </div>
            </div>
          )
        })}
      </section>

      {fixtures.some((f) => isLocked(f, now)) && (
        <section className="space-y-4">
          <h2 className="font-display text-lg font-semibold">Pronósticos del grupo</h2>
          {fixtures
            .filter((f) => isLocked(f, now))
            .map((f) => {
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
