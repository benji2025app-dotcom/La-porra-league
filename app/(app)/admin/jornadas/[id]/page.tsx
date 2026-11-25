import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { kickoff, money } from '@/lib/format'
import { isoToMadridLocal } from '@/lib/time'
import type { Tables } from '@/lib/database.types'
import { ActionForm } from '@/components/action-form'
import { Field } from '@/components/ui'
import { RoundStatus } from '@/components/round-status'
import { CLUB_EDGE, CLUB_NAME } from '@/components/fixture-row'
import {
  deleteRound,
  reopenRound,
  replaceFixture,
  saveFixture,
  setFixturePostponed,
  setFixtureResult,
  setRoundStatus,
  settleRound,
  voidRound,
} from '../../actions'

export const metadata: Metadata = { title: 'Gestionar jornada' }

type Fixture = Tables<'fixtures'>
type Club = Fixture['club']

const COMPETITIONS = ['LaLiga', 'Champions League', 'Copa del Rey', 'Supercopa de España', 'Mundial de Clubes', 'Supercopa de Europa']
const DEFAULT_TEAM: Record<Club, string> = { barcelona: 'FC Barcelona', real_madrid: 'Real Madrid' }

function Hidden(props: Record<string, string>) {
  return (
    <>
      {Object.entries(props).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
    </>
  )
}

function FixtureFields({ club, fixture }: { club: Club; fixture?: Fixture }) {
  return (
    <>
      <Field label="Competición" name="competition" list="competiciones" defaultValue={fixture?.competition ?? 'LaLiga'} required />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Local" name="home_team" defaultValue={fixture?.home_team ?? DEFAULT_TEAM[club]} required />
        <Field label="Visitante" name="away_team" defaultValue={fixture?.away_team ?? ''} required />
      </div>
      <Field
        label="Inicio (hora de Madrid)"
        name="kickoff"
        type="datetime-local"
        defaultValue={fixture ? isoToMadridLocal(fixture.kickoff_at) : ''}
        required
      />
    </>
  )
}

function ScoreInput({ name, label, value }: { name: string; label: string; value: number | null }) {
  return (
    <label className="block">
      <span className="mb-1 block truncate text-xs text-ivory-muted">{label}</span>
      <input
        className="field text-center font-display text-2xl font-bold"
        name={name}
        type="number"
        inputMode="numeric"
        min={0}
        max={30}
        defaultValue={value ?? ''}
        required
      />
    </label>
  )
}

function FixtureCard({ roundId, roundStatus, club, fixture }: { roundId: string; roundStatus: Tables<'rounds'>['status']; club: Club; fixture?: Fixture }) {
  const closed = roundStatus === 'settled' || roundStatus === 'void'
  const locked = !!fixture && (fixture.locked_at !== null || new Date(fixture.kickoff_at) <= new Date() || ['live', 'finished'].includes(fixture.status))
  const base = { round_id: roundId, club }

  return (
    <article className="relative overflow-hidden rounded-2xl border border-line bg-carbon-2 p-4 pl-5">
      <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${CLUB_EDGE[club]}`} />
      <h3 className="font-display text-base font-semibold">{CLUB_NAME[club]}</h3>

      {!fixture ? (
        closed ? (
          <p className="mt-2 text-sm text-ivory-muted">Sin partido.</p>
        ) : (
          <ActionForm action={saveFixture} label="Añadir partido" className="mt-3">
            <Hidden {...base} />
            <FixtureFields club={club} />
          </ActionForm>
        )
      ) : (
        <>
          <p className="mt-1 text-sm">
            {fixture.home_team} <span className="text-ivory-muted">vs</span> {fixture.away_team}
          </p>
          <p className="text-xs text-ivory-muted">
            {fixture.competition}, {kickoff(fixture.kickoff_at)}
            {fixture.status === 'postponed' && <span className="font-medium text-danger">, aplazado</span>}
            {locked && fixture.status !== 'finished' && ', en juego o terminado'}
          </p>
          {fixture.status === 'finished' && (
            <p className="mt-2 font-display text-2xl font-bold text-gold-bright tabular-nums">
              {fixture.home_goals}–{fixture.away_goals}
            </p>
          )}

          {!closed && !locked && (
            <div className="mt-3 space-y-3">
              <details>
                <summary className="cursor-pointer text-sm text-ivory-muted">Editar partido</summary>
                <ActionForm action={saveFixture} label="Guardar cambios" className="mt-3">
                  <Hidden {...base} fixture_id={fixture.id} />
                  <FixtureFields club={club} fixture={fixture} />
                </ActionForm>
              </details>
              <details>
                <summary className="cursor-pointer text-sm text-ivory-muted">Sustituir partido (aplazamiento)</summary>
                <p className="mt-2 text-xs text-ivory-muted">
                  Cambia el partido por otro y borra los pronósticos que había para él (quedan registrados). Avisa al grupo para que vuelvan a pronosticar.
                </p>
                <ActionForm action={replaceFixture} label="Sustituir partido" variant="danger" confirm="Confirmar: reiniciar pronósticos" className="mt-3">
                  <Hidden {...base} fixture_id={fixture.id} />
                  <FixtureFields club={club} fixture={fixture} />
                </ActionForm>
              </details>
              <ActionForm
                action={setFixturePostponed}
                label={fixture.status === 'postponed' ? 'Quitar aplazamiento' : 'Marcar como aplazado'}
                variant="outline"
              >
                <Hidden fixture_id={fixture.id} round_id={roundId} postponed={String(fixture.status !== 'postponed')} />
              </ActionForm>
            </div>
          )}

          {!closed && locked && (
            <ActionForm action={setFixtureResult} label={fixture.status === 'finished' ? 'Corregir resultado' : 'Guardar resultado final'} className="mt-3">
              <Hidden fixture_id={fixture.id} round_id={roundId} />
              <div className="grid grid-cols-2 gap-3">
                <ScoreInput name="home_goals" label={fixture.home_team} value={fixture.home_goals} />
                <ScoreInput name="away_goals" label={fixture.away_team} value={fixture.away_goals} />
              </div>
            </ActionForm>
          )}
        </>
      )}
    </article>
  )
}

export default async function AdminRoundPage({ params }: PageProps<'/admin/jornadas/[id]'>) {
  const { id } = await params
  const { supabase } = await requireAdmin()
  const { data: round } = await supabase
    .from('rounds')
    .select('id, name, number, status, fixtures(*), round_settlements(*), round_winners(share_cents, profiles(display_name))')
    .eq('id', id)
    .maybeSingle()
  if (!round) notFound()

  const fixtures = round.fixtures ?? []
  const byClub = (c: Club) => fixtures.find((f) => f.club === c)
  const settlement = Array.isArray(round.round_settlements) ? round.round_settlements[0] : round.round_settlements
  const { data: submissions } = round.status === 'open' ? await supabase.rpc('get_round_submissions', { p_round_id: id }) : { data: null }
  const closed = round.status === 'settled' || round.status === 'void'

  return (
    <div className="space-y-6">
      <datalist id="competiciones">
        {COMPETITIONS.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      <div className="flex items-center justify-between gap-3">
        <div>
          <Link href="/admin/jornadas" className="text-sm text-ivory-muted hover:text-ivory">
            Jornadas
          </Link>
          <h2 className="font-display text-xl font-semibold">{round.name}</h2>
        </div>
        <RoundStatus status={round.status} />
      </div>

      <FixtureCard roundId={id} roundStatus={round.status} club="barcelona" fixture={byClub('barcelona')} />
      <FixtureCard roundId={id} roundStatus={round.status} club="real_madrid" fixture={byClub('real_madrid')} />

      {round.status === 'draft' && (
        <section className="space-y-3">
          <ActionForm action={setRoundStatus} label="Publicar jornada" pending="Publicando…">
            <Hidden round_id={id} status="open" />
          </ActionForm>
          <p className="text-xs text-ivory-muted">Al publicarla, todos los jugadores la verán y podrán rellenar su boleto.</p>
          <ActionForm action={deleteRound} label="Borrar jornada" variant="danger" confirm="Confirmar borrado">
            <Hidden round_id={id} />
          </ActionForm>
        </section>
      )}

      {round.status === 'open' && (
        <>
          {submissions && (
            <section>
              <h3 className="font-display text-base font-semibold">Boletos</h3>
              <ul className="mt-2 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-carbon-2 text-sm">
                {submissions.map((s) => (
                  <li key={s.user_id} className="flex justify-between px-4 py-2.5">
                    <span>{s.display_name}</span>
                    <span className={s.submitted_count === 2 ? 'text-ok' : 'text-ivory-muted'}>{s.submitted_count}/2</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section className="space-y-3 rounded-2xl border border-gold/40 bg-carbon-2 p-4">
            <h3 className="font-display text-base font-semibold">Cerrar la jornada</h3>
            <p className="text-sm text-ivory-muted">
              Liquidar calcula los ganadores (los dos marcadores exactos) y reparte el bote. Si nadie acierta, se acumula.
            </p>
            <ActionForm action={settleRound} label="Liquidar jornada" pending="Calculando…" confirm="Confirmar liquidación">
              <Hidden round_id={id} />
            </ActionForm>
            <details className="pt-2">
              <summary className="cursor-pointer text-sm text-ivory-muted">Anular jornada (aplazamiento)</summary>
              <ActionForm action={voidRound} label="Anular jornada" variant="danger" confirm="Confirmar anulación" className="mt-3">
                <Hidden round_id={id} />
                <Field label="Motivo" name="reason" placeholder="Partido del Madrid aplazado" maxLength={200} required />
                <p className="text-xs text-ivory-muted">Sin ganadores. Los boletos completos suman al bote.</p>
              </ActionForm>
            </details>
            <details>
              <summary className="cursor-pointer text-sm text-ivory-muted">Volver a borrador</summary>
              <ActionForm action={setRoundStatus} label="Volver a borrador" variant="outline" className="mt-3">
                <Hidden round_id={id} status="draft" />
              </ActionForm>
            </details>
          </section>
        </>
      )}

      {closed && settlement && (
        <section className="space-y-3 rounded-2xl border border-line bg-carbon-2 p-4 text-sm">
          <h3 className="font-display text-base font-semibold">{settlement.kind === 'void' ? 'Jornada anulada' : 'Liquidación'}</h3>
          {settlement.reason && <p className="text-ivory-muted">Motivo: {settlement.reason}</p>}
          <dl className="grid grid-cols-2 gap-y-1.5">
            <dt className="text-ivory-muted">Boletos completos</dt>
            <dd className="text-right tabular-nums">{settlement.participants_count}</dd>
            <dt className="text-ivory-muted">Al bote</dt>
            <dd className="text-right tabular-nums">{money(settlement.contribution_total_cents)}</dd>
            <dt className="text-ivory-muted">Gestión</dt>
            <dd className="text-right tabular-nums">{money(settlement.admin_fee_total_cents)}</dd>
            <dt className="text-ivory-muted">Bote en juego</dt>
            <dd className="text-right tabular-nums">{money(settlement.pot_in_play_cents)}</dd>
            <dt className="text-ivory-muted">Ganadores</dt>
            <dd className="text-right tabular-nums">{settlement.winners_count}</dd>
            {settlement.winners_count > 0 && (
              <>
                <dt className="text-ivory-muted">Premio por ganador</dt>
                <dd className="text-right tabular-nums text-gold-bright">{money(settlement.share_cents)}</dd>
              </>
            )}
            <dt className="text-ivory-muted">Bote que queda</dt>
            <dd className="text-right tabular-nums">{money(settlement.pot_after_cents)}</dd>
          </dl>
          {(round.round_winners ?? []).length > 0 && (
            <p>
              Ganadores: <strong>{round.round_winners!.map((w) => w.profiles?.display_name).join(', ')}</strong>
            </p>
          )}
          <details className="pt-2">
            <summary className="cursor-pointer text-ivory-muted">Reabrir para corregir</summary>
            <p className="mt-2 text-xs text-ivory-muted">Deshace la liquidación y sus movimientos de bote. Solo se puede con la última jornada cerrada.</p>
            <ActionForm action={reopenRound} label="Reabrir jornada" variant="danger" confirm="Confirmar reapertura" className="mt-3">
              <Hidden round_id={id} />
            </ActionForm>
          </details>
        </section>
      )}
    </div>
  )
}
