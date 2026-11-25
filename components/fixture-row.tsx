import type { Tables } from '@/lib/database.types'
import { kickoff } from '@/lib/format'

type Fixture = Pick<Tables<'fixtures'>, 'id' | 'club' | 'competition' | 'home_team' | 'away_team' | 'kickoff_at' | 'status' | 'home_goals' | 'away_goals'>

// Filo de color del club al que pertenece el partido.
export const CLUB_EDGE: Record<Fixture['club'], string> = {
  barcelona: 'bg-gradient-to-b from-barca-blue to-barca-garnet',
  real_madrid: 'bg-gradient-to-b from-ivory to-madrid',
}

export const CLUB_NAME: Record<Fixture['club'], string> = {
  barcelona: 'Partido del Barça',
  real_madrid: 'Partido del Madrid',
}

export function FixtureRow({ fixture, right }: { fixture: Fixture; right?: React.ReactNode }) {
  const finished = fixture.status === 'finished' && fixture.home_goals !== null
  return (
    <div className="relative flex items-center gap-4 overflow-hidden rounded-2xl border border-line bg-carbon-2 py-3.5 pl-5 pr-4">
      <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${CLUB_EDGE[fixture.club]}`} />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-ivory-muted">
          {fixture.competition}, {kickoff(fixture.kickoff_at)}
        </p>
        <p className="mt-1 truncate font-semibold">
          {fixture.home_team} <span className="font-normal text-ivory-muted">vs</span> {fixture.away_team}
        </p>
        {fixture.status === 'postponed' && <p className="mt-1 text-xs font-medium text-danger">Aplazado</p>}
      </div>
      {finished ? (
        <span className="font-display text-xl font-bold tabular-nums text-gold-bright">
          {fixture.home_goals}–{fixture.away_goals}
        </span>
      ) : (
        right
      )}
    </div>
  )
}
