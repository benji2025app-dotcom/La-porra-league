import Link from 'next/link'
import { Check, Clock } from 'lucide-react'
import { requireMember } from '@/lib/auth'
import { money } from '@/lib/format'
import { FixtureRow } from '@/components/fixture-row'

export default async function HomePage() {
  const { supabase, user, profile } = await requireMember()

  const [{ data: balance }, { data: season }, { data: round }] = await Promise.all([
    supabase.rpc('get_pot_balance'),
    supabase.from('seasons').select('pot_contribution_cents').eq('is_active', true).maybeSingle(),
    supabase
      .from('rounds')
      .select('id, name, number, fixtures(id, club, competition, home_team, away_team, kickoff_at, status, home_goals, away_goals)')
      .eq('status', 'open')
      .order('number', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ])

  const fixtures = [...(round?.fixtures ?? [])].sort((a, b) => a.kickoff_at.localeCompare(b.kickoff_at))
  const fixtureIds = fixtures.map((f) => f.id)

  const [{ data: pot }, { data: submissions }, { data: mine }] = round
    ? await Promise.all([
        supabase.rpc('get_round_pot', { p_round_id: round.id }).maybeSingle(),
        supabase.rpc('get_round_submissions', { p_round_id: round.id }),
        supabase.from('predictions').select('fixture_id, home_goals, away_goals').eq('user_id', user.id).in('fixture_id', fixtureIds),
      ])
    : [{ data: null }, { data: null }, { data: null }]

  const myByFixture = new Map((mine ?? []).map((p) => [p.fixture_id, p]))
  const potInPlay = pot?.pot_in_play_cents ?? balance ?? 0
  const complete = (submissions ?? []).filter((s) => s.submitted_count === 2).length
  const ticketDone = fixtures.length === 2 && fixtures.every((f) => myByFixture.has(f.id))

  return (
    <div className="space-y-8">
      <section aria-labelledby="bote" className="gold-frame overflow-hidden px-6 pb-6 pt-5">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(60%_100%_at_50%_0%,rgb(237_208_137/0.18),transparent)]" />
        <h2 id="bote" className="relative text-sm text-ivory-muted">
          {round ? `Bote en juego, ${round.name}` : 'Bote acumulado'}
        </h2>
        <p className="relative mt-1 font-display text-[2.9rem] font-bold leading-none tracking-tight text-gold-bright tabular-nums">
          {money(potInPlay)}
        </p>
        {round && (
          <p className="relative mt-3 text-sm text-ivory-muted">
            {complete === 1 ? '1 boleto completo' : `${complete} boletos completos`}. Cada boleto suma {money(season?.pot_contribution_cents ?? 0)} al bote.
          </p>
        )}
      </section>

      {round ? (
        <section aria-labelledby="jornada" className="space-y-3">
          <div className="flex items-end justify-between">
            <h2 id="jornada" className="font-display text-xl font-semibold">
              {round.name}
            </h2>
            <Link href="/boleto" className="text-sm font-semibold text-gold-bright underline-offset-4 hover:underline">
              {ticketDone ? 'Ver mi boleto' : 'Rellenar boleto'}
            </Link>
          </div>
          {fixtures.map((f) => {
            const p = myByFixture.get(f.id)
            return (
              <FixtureRow
                key={f.id}
                fixture={f}
                right={
                  p ? (
                    <span className="font-display text-lg font-bold tabular-nums text-ivory" aria-label={`Tu pronóstico ${p.home_goals} a ${p.away_goals}`}>
                      {p.home_goals}–{p.away_goals}
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-gold">Sin pronóstico</span>
                  )
                }
              />
            )
          })}
        </section>
      ) : (
        <section className="rounded-2xl border border-dashed border-line px-5 py-8 text-center">
          <p className="font-display text-lg">No hay jornada abierta</p>
          <p className="mt-1 text-sm text-ivory-muted">
            {profile.role === 'admin' ? 'Crea la siguiente jornada desde el panel de administración.' : 'El administrador publicará la siguiente en cuanto se conozcan los partidos.'}
          </p>
        </section>
      )}

      {round && submissions && (
        <section aria-labelledby="participantes">
          <h2 id="participantes" className="font-display text-xl font-semibold">
            Participantes
          </h2>
          <p className="mt-1 text-sm text-ivory-muted">Los marcadores de los demás se ven al empezar cada partido.</p>
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-carbon-2">
            {submissions.map((s) => (
              <li key={s.user_id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className={s.user_id === user.id ? 'font-semibold' : ''}>{s.display_name}</span>
                {s.submitted_count === 2 ? (
                  <span className="flex items-center gap-1.5 text-ok">
                    <Check size={16} aria-hidden /> Boleto enviado
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-ivory-muted">
                    <Clock size={15} aria-hidden /> {s.submitted_count === 1 ? 'Falta 1 marcador' : 'Pendiente'}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
