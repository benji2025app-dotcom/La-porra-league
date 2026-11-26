import type { Tables } from '@/lib/database.types'
import type { League, Team } from '@/lib/auth'

const TEAM = 'id, name, short_name, crest_url'

// Campos de partido con los equipos (para los escudos).
export const FIXTURE_SELECT = `id, round_id, club_team_id, competition, home_team, away_team, kickoff_at, status, locked_at, home_goals, away_goals, home_team_id, away_team_id, home:teams!fixtures_home_team_id_fkey(${TEAM}), away:teams!fixtures_away_team_id_fkey(${TEAM})`

export type FixtureView = Pick<
  Tables<'fixtures'>,
  | 'id'
  | 'round_id'
  | 'club_team_id'
  | 'competition'
  | 'home_team'
  | 'away_team'
  | 'kickoff_at'
  | 'status'
  | 'locked_at'
  | 'home_goals'
  | 'away_goals'
  | 'home_team_id'
  | 'away_team_id'
> & { home: Team | null; away: Team | null }

// Ordena los partidos: primero el del club A de la porra, después el del club B.
export function byLeagueClub(league: League) {
  return (a: { club_team_id: string }, b: { club_team_id: string }) =>
    Number(a.club_team_id === league.club_b.id) - Number(b.club_team_id === league.club_b.id)
}

export function clubOf(league: League, clubTeamId: string) {
  return clubTeamId === league.club_a.id ? league.club_a : league.club_b
}

export function isLocked(f: Pick<Tables<'fixtures'>, 'locked_at' | 'kickoff_at' | 'status'>, now: number) {
  return f.locked_at !== null || new Date(f.kickoff_at).getTime() <= now || f.status === 'live' || f.status === 'finished'
}
