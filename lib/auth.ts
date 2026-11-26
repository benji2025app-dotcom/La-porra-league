import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Tables } from '@/lib/database.types'

export type Profile = Pick<Tables<'profiles'>, 'id' | 'display_name' | 'role' | 'status'>
export type Team = Pick<Tables<'teams'>, 'id' | 'name' | 'short_name' | 'crest_url'>
export type League = { id: string; name: string; is_active: boolean; club_a: Team; club_b: Team }

export const LEAGUE_COOKIE = 'porra_liga'

// Capa de acceso: valida la sesión contra Supabase Auth (no confía en la cookie).
export const getSession = cache(async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, profile: null as Profile | null }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, display_name, role, status')
    .eq('id', user.id)
    .maybeSingle()

  return { supabase, user, profile: (profile ?? null) as Profile | null }
})

const TEAM_FIELDS = 'id, name, short_name, crest_url'

/**
 * Porra en la que está trabajando el usuario.
 * Jugadores: solo sus porras con membresía activa. Admin: todas.
 * La porra elegida se recuerda en una cookie; si no es válida se usa la primera.
 */
export const getLeagueContext = cache(async () => {
  const session = await getSession()
  if (!session.user) redirect('/login')
  if (!session.profile || session.profile.status === 'blocked') redirect('/pendiente')
  const { supabase, user, profile } = session
  const isAdmin = profile.role === 'admin'

  const [{ data: leagueRows }, { data: memberships }] = await Promise.all([
    supabase
      .from('leagues')
      .select(`id, name, is_active, club_a:teams!leagues_club_a_id_fkey(${TEAM_FIELDS}), club_b:teams!leagues_club_b_id_fkey(${TEAM_FIELDS})`)
      .order('created_at'),
    supabase.from('league_members').select('league_id, status').eq('user_id', user.id),
  ])

  const activeIds = new Set((memberships ?? []).filter((m) => m.status === 'active').map((m) => m.league_id))
  const all = (leagueRows ?? []) as unknown as League[]
  const leagues = isAdmin ? all : all.filter((l) => activeIds.has(l.id) && l.is_active)
  if (leagues.length === 0) redirect('/pendiente')

  const chosen = (await cookies()).get(LEAGUE_COOKIE)?.value
  const league = leagues.find((l) => l.id === chosen) ?? leagues[0]

  return { supabase, user, profile, isAdmin, leagues, league, isPlayer: activeIds.has(league.id) }
})

export async function requireLeague() {
  return getLeagueContext()
}

export async function requireAdmin() {
  const ctx = await getLeagueContext()
  if (!ctx.isAdmin) redirect('/')
  return ctx
}
