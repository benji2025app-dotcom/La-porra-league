import { kickoff } from '@/lib/format'
import type { FixtureView } from '@/lib/queries'
import { Crest, clubEdge } from '@/components/crest'

export function FixtureRow({ fixture, clubName, right }: { fixture: FixtureView; clubName?: string; right?: React.ReactNode }) {
  const finished = fixture.status === 'finished' && fixture.home_goals !== null
  return (
    <div className="relative overflow-hidden rounded-2xl border border-line bg-carbon-2 py-3.5 pl-5 pr-4">
      <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: clubEdge(clubName) }} />
      <p className="text-xs text-ivory-muted">
        {fixture.competition}, {kickoff(fixture.kickoff_at)}
        {fixture.status === 'postponed' && <span className="font-medium text-danger">, aplazado</span>}
      </p>
      <div className="mt-2 flex items-center gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="flex items-center gap-2 font-semibold">
            <Crest team={fixture.home} name={fixture.home_team} size={22} />
            <span className="truncate">{fixture.home_team}</span>
          </p>
          <p className="flex items-center gap-2 font-semibold">
            <Crest team={fixture.away} name={fixture.away_team} size={22} />
            <span className="truncate">{fixture.away_team}</span>
          </p>
        </div>
        {finished ? (
          <span className="font-display text-xl font-bold tabular-nums text-gold-bright">
            {fixture.home_goals}–{fixture.away_goals}
          </span>
        ) : (
          right
        )}
      </div>
    </div>
  )
}
