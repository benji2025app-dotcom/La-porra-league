'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { dbError } from '@/lib/errors'
import { madridLocalToIso } from '@/lib/time'
import { findCrest } from '@/lib/crests'
import { catalogTeam, normTeam } from '@/lib/team-catalog'
import type { FormState } from '@/app/(auth)/actions'

const uuid = z.uuid()
const goals = z.coerce.number().int().min(0, 'Goles entre 0 y 30.').max(30, 'Goles entre 0 y 30.')
const teamName = z.string().trim().min(2, 'Nombre de equipo demasiado corto.').max(60)
type Supa = Awaited<ReturnType<typeof requireAdmin>>['supabase']

function refresh(roundId?: string) {
  revalidatePath('/', 'layout')
  if (roundId) revalidatePath(`/admin/jornadas/${roundId}`)
}

// Devuelve el equipo con ese nombre (o uno equivalente: "Alavés" = "Deportivo Alavés").
// Si no existe lo crea con su escudo del catálogo o, si no está, lo busca fuera.
async function ensureTeam(supabase: Supa, name: string) {
  const clean = name.trim()
  const known = catalogTeam(clean)
  const keys = new Set([normTeam(clean), ...(known ? [known.name, known.short, ...known.aliases].map(normTeam) : [])])
  const { data: teams } = await supabase.from('teams').select('id, name, short_name, crest_url')
  const found = (teams ?? []).find((t) => keys.has(normTeam(t.name)) || (t.short_name && keys.has(normTeam(t.short_name))))
  if (found) {
    if (!found.crest_url) {
      const crest = known?.crest ?? (await findCrest(clean))
      if (crest) await supabase.from('teams').update({ crest_url: crest }).eq('id', found.id)
    }
    return found.id
  }
  const crest = known?.crest ?? (await findCrest(clean))
  const { data: created, error } = await supabase
    .from('teams')
    .insert({ name: known?.name ?? clean, short_name: known?.short ?? null, crest_url: crest })
    .select('id')
    .single()
  if (error) throw new Error(dbError(error, 'No se ha podido crear el equipo.'))
  return created.id
}

// Jugadores ------------------------------------------------------------------------------
export async function setMembership(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = z
    .object({ league_id: uuid, user_id: uuid, status: z.enum(['active', 'blocked', 'pending']) })
    .safeParse({ league_id: fd.get('league_id'), user_id: fd.get('user_id'), status: fd.get('status') })
  if (!parsed.success) return { error: 'Datos no válidos.' }
  const { supabase } = await requireAdmin()
  const { error } = await supabase.rpc('admin_set_membership', {
    p_league_id: parsed.data.league_id,
    p_user_id: parsed.data.user_id,
    p_status: parsed.data.status,
  })
  if (error) return { error: dbError(error) }
  refresh()
  return { success: parsed.data.status === 'active' ? 'Jugador dentro de la porra.' : 'Jugador fuera de la porra.' }
}

export async function setAccountStatus(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = z
    .object({ user_id: uuid, status: z.enum(['active', 'blocked']) })
    .safeParse({ user_id: fd.get('user_id'), status: fd.get('status') })
  if (!parsed.success) return { error: 'Datos no válidos.' }
  const { supabase } = await requireAdmin()
  const { error } = await supabase.rpc('admin_set_account_status', { p_user_id: parsed.data.user_id, p_status: parsed.data.status })
  if (error) return { error: dbError(error) }
  refresh()
  return { success: parsed.data.status === 'blocked' ? 'Cuenta desactivada en todas las porras.' : 'Cuenta reactivada.' }
}

export async function setMemberRole(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = z
    .object({ user_id: uuid, role: z.enum(['admin', 'player']) })
    .safeParse({ user_id: fd.get('user_id'), role: fd.get('role') })
  if (!parsed.success) return { error: 'Datos no válidos.' }
  const { supabase } = await requireAdmin()
  const { error } = await supabase.rpc('admin_set_member_role', { p_user_id: parsed.data.user_id, p_role: parsed.data.role })
  if (error) return { error: dbError(error) }
  refresh()
  return { success: 'Rol actualizado.' }
}

export async function createInviteCode(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = z
    .object({
      league_id: uuid,
      note: z.string().trim().max(80).optional(),
      max_uses: z.coerce.number().int().min(1).max(200),
      days: z.coerce.number().int().min(1).max(90),
    })
    .safeParse({ league_id: fd.get('league_id'), note: fd.get('note') || undefined, max_uses: fd.get('max_uses'), days: fd.get('days') })
  if (!parsed.success) return { error: 'Revisa los usos (1-200) y los días de validez (1-90).' }
  const { supabase } = await requireAdmin()
  const expires = new Date(Date.now() + parsed.data.days * 86400000).toISOString()
  const { data, error } = await supabase.rpc('admin_create_invite_code', {
    p_league_id: parsed.data.league_id,
    p_note: parsed.data.note,
    p_max_uses: parsed.data.max_uses,
    p_expires_at: expires,
  })
  if (error) return { error: dbError(error) }
  revalidatePath('/admin/jugadores')
  return { success: `Código creado: ${data}` }
}

export async function setInviteActive(_: FormState, fd: FormData): Promise<FormState> {
  const code = String(fd.get('code') ?? '')
  const active = fd.get('active') === 'true'
  const { supabase } = await requireAdmin()
  const { error } = await supabase.rpc('admin_set_invite_code_active', { p_code: code, p_active: active })
  if (error) return { error: dbError(error) }
  revalidatePath('/admin/jugadores')
  return { success: active ? 'Código activado.' : 'Código desactivado.' }
}

// Porras y equipos --------------------------------------------------------------------------
export async function createLeague(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = z
    .object({ name: z.string().trim().min(2, 'Ponle nombre a la porra.').max(40), club_a: teamName, club_b: teamName, join: z.boolean() })
    .safeParse({ name: fd.get('name'), club_a: fd.get('club_a'), club_b: fd.get('club_b'), join: fd.get('join') === 'on' })
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  if (parsed.data.club_a.toLowerCase() === parsed.data.club_b.toLowerCase()) return { error: 'Los dos clubes deben ser distintos.' }
  const { supabase, user } = await requireAdmin()
  try {
    const [a, b] = await Promise.all([ensureTeam(supabase, parsed.data.club_a), ensureTeam(supabase, parsed.data.club_b)])
    const { data, error } = await supabase.from('leagues').insert({ name: parsed.data.name, club_a_id: a, club_b_id: b }).select('id').single()
    if (error) return { error: error.code === '23505' ? 'Ya existe una porra con ese nombre.' : dbError(error) }
    if (parsed.data.join) {
      await supabase.rpc('admin_set_membership', { p_league_id: data.id, p_user_id: user.id, p_status: 'active' })
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'No se ha podido crear la porra.' }
  }
  refresh()
  return { success: `Porra "${parsed.data.name}" creada. Elígela arriba para crear su primera jornada y sus códigos.` }
}

export async function updateLeague(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = z
    .object({ league_id: uuid, name: z.string().trim().min(2).max(40), is_active: z.boolean() })
    .safeParse({ league_id: fd.get('league_id'), name: fd.get('name'), is_active: fd.get('is_active') === 'on' })
  if (!parsed.success) return { error: 'Nombre no válido.' }
  const { supabase } = await requireAdmin()
  const { error } = await supabase
    .from('leagues')
    .update({ name: parsed.data.name, is_active: parsed.data.is_active })
    .eq('id', parsed.data.league_id)
  if (error) return { error: error.code === '23505' ? 'Ya existe una porra con ese nombre.' : dbError(error) }
  refresh()
  return { success: 'Porra guardada.' }
}

export async function updateTeam(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = z
    .object({
      team_id: uuid,
      name: teamName,
      short_name: z.string().trim().max(14).optional(),
      crest_url: z.union([z.literal(''), z.url({ protocol: /^https$/, message: 'El escudo debe ser un enlace https.' })]),
    })
    .safeParse({
      team_id: fd.get('team_id'),
      name: fd.get('name'),
      short_name: fd.get('short_name') || undefined,
      crest_url: String(fd.get('crest_url') ?? '').trim(),
    })
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const { supabase } = await requireAdmin()
  const { error } = await supabase
    .from('teams')
    .update({ name: parsed.data.name, short_name: parsed.data.short_name ?? null, crest_url: parsed.data.crest_url || null })
    .eq('id', parsed.data.team_id)
  if (error) return { error: error.code === '23505' ? 'Ya existe un equipo con ese nombre.' : dbError(error) }
  refresh()
  return { success: 'Equipo guardado.' }
}

export async function findMissingCrests(): Promise<FormState> {
  const { supabase } = await requireAdmin()
  const { data: teams } = await supabase.from('teams').select('id, name').is('crest_url', null).limit(30)
  let found = 0
  for (const t of teams ?? []) {
    const crest = await findCrest(t.name)
    if (crest) {
      await supabase.from('teams').update({ crest_url: crest }).eq('id', t.id)
      found++
    }
  }
  refresh()
  const missing = (teams ?? []).length - found
  return {
    success:
      found === 0 && missing === 0
        ? 'Todos los equipos tienen escudo.'
        : `Escudos encontrados: ${found}.${missing ? ` Sin encontrar: ${missing} (puedes pegar su enlace a mano).` : ''}`,
  }
}

// Jornadas --------------------------------------------------------------------------------------
export async function createRound(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = z
    .object({ league_id: uuid, number: z.coerce.number().int().min(1).max(999), name: z.string().trim().max(60).optional() })
    .safeParse({ league_id: fd.get('league_id'), number: fd.get('number'), name: fd.get('name') || undefined })
  if (!parsed.success) return { error: 'Número de jornada no válido.' }
  const { supabase } = await requireAdmin()
  const { data: season } = await supabase.from('seasons').select('id').eq('is_active', true).single()
  if (!season) return { error: 'No hay temporada activa.' }
  const { data, error } = await supabase
    .from('rounds')
    .insert({
      league_id: parsed.data.league_id,
      season_id: season.id,
      number: parsed.data.number,
      name: parsed.data.name || `Jornada ${parsed.data.number}`,
    })
    .select('id')
    .single()
  if (error) return { error: error.code === '23505' ? 'Ya existe una jornada con ese número en esta porra.' : dbError(error) }
  revalidatePath('/admin/jornadas')
  redirect(`/admin/jornadas/${data.id}`)
}

export async function setRoundStatus(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = z
    .object({ round_id: uuid, status: z.enum(['draft', 'open']) })
    .safeParse({ round_id: fd.get('round_id'), status: fd.get('status') })
  if (!parsed.success) return { error: 'Datos no válidos.' }
  const { supabase } = await requireAdmin()
  const { error } = await supabase.from('rounds').update({ status: parsed.data.status }).eq('id', parsed.data.round_id)
  if (error) return { error: dbError(error) }
  refresh(parsed.data.round_id)
  return { success: parsed.data.status === 'open' ? 'Jornada publicada: ya se puede pronosticar.' : 'Jornada devuelta a borrador.' }
}

export async function deleteRound(_: FormState, fd: FormData): Promise<FormState> {
  const roundId = uuid.safeParse(fd.get('round_id'))
  if (!roundId.success) return { error: 'Datos no válidos.' }
  const { supabase } = await requireAdmin()
  const { error: fxError } = await supabase.from('fixtures').delete().eq('round_id', roundId.data)
  if (fxError) return { error: dbError(fxError) }
  const { error } = await supabase.from('rounds').delete().eq('id', roundId.data)
  if (error) return { error: dbError(error) }
  revalidatePath('/admin/jornadas')
  redirect('/admin/jornadas')
}

const fixtureSchema = z.object({
  round_id: uuid,
  club_team_id: uuid,
  competition: z.string().trim().min(2, 'Escribe la competición.').max(60),
  home_team: teamName,
  away_team: teamName,
  kickoff: z.string(),
})

function readFixture(fd: FormData) {
  return fixtureSchema.safeParse({
    round_id: fd.get('round_id'),
    club_team_id: fd.get('club_team_id'),
    competition: fd.get('competition'),
    home_team: fd.get('home_team'),
    away_team: fd.get('away_team'),
    kickoff: fd.get('kickoff'),
  })
}

export async function saveFixture(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = readFixture(fd)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const kickoffIso = madridLocalToIso(parsed.data.kickoff)
  if (!kickoffIso) return { error: 'Fecha y hora no válidas.' }
  const fixtureId = fd.get('fixture_id') ? String(fd.get('fixture_id')) : null
  const { supabase } = await requireAdmin()
  let homeId: string, awayId: string
  try {
    ;[homeId, awayId] = await Promise.all([ensureTeam(supabase, parsed.data.home_team), ensureTeam(supabase, parsed.data.away_team)])
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'No se han podido guardar los equipos.' }
  }
  if (parsed.data.club_team_id !== homeId && parsed.data.club_team_id !== awayId) {
    return { error: 'El club de la porra tiene que ser el local o el visitante de este partido.' }
  }
  const values = {
    competition: parsed.data.competition,
    home_team: parsed.data.home_team,
    away_team: parsed.data.away_team,
    home_team_id: homeId,
    away_team_id: awayId,
    kickoff_at: kickoffIso,
  }
  const { error } = fixtureId
    ? await supabase.from('fixtures').update(values).eq('id', fixtureId)
    : await supabase.from('fixtures').insert({ ...values, round_id: parsed.data.round_id, club_team_id: parsed.data.club_team_id })
  if (error) return { error: dbError(error) }
  refresh(parsed.data.round_id)
  return { success: 'Partido guardado.' }
}

export async function replaceFixture(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = readFixture(fd)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const kickoffIso = madridLocalToIso(parsed.data.kickoff)
  const fixtureId = uuid.safeParse(fd.get('fixture_id'))
  if (!kickoffIso || !fixtureId.success) return { error: 'Datos no válidos.' }
  const { supabase } = await requireAdmin()
  let homeId: string, awayId: string
  try {
    ;[homeId, awayId] = await Promise.all([ensureTeam(supabase, parsed.data.home_team), ensureTeam(supabase, parsed.data.away_team)])
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'No se han podido guardar los equipos.' }
  }
  if (parsed.data.club_team_id !== homeId && parsed.data.club_team_id !== awayId) {
    return { error: 'El club de la porra tiene que ser el local o el visitante de este partido.' }
  }
  const { error } = await supabase.rpc('admin_replace_fixture', {
    p_fixture_id: fixtureId.data,
    p_competition: parsed.data.competition,
    p_home_team: parsed.data.home_team,
    p_away_team: parsed.data.away_team,
    p_kickoff_at: kickoffIso,
    p_home_team_id: homeId,
    p_away_team_id: awayId,
  })
  if (error) return { error: dbError(error) }
  refresh(parsed.data.round_id)
  return { success: 'Partido sustituido. Los pronósticos de ese partido se han reiniciado.' }
}

export async function setFixtureResult(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = z
    .object({ fixture_id: uuid, round_id: uuid, home_goals: goals, away_goals: goals })
    .safeParse({
      fixture_id: fd.get('fixture_id'),
      round_id: fd.get('round_id'),
      home_goals: fd.get('home_goals'),
      away_goals: fd.get('away_goals'),
    })
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const { supabase } = await requireAdmin()
  const { error } = await supabase
    .from('fixtures')
    .update({ home_goals: parsed.data.home_goals, away_goals: parsed.data.away_goals, status: 'finished' })
    .eq('id', parsed.data.fixture_id)
  if (error) return { error: dbError(error) }
  refresh(parsed.data.round_id)
  return { success: 'Resultado guardado.' }
}

export async function setFixturePostponed(_: FormState, fd: FormData): Promise<FormState> {
  const fixtureId = uuid.safeParse(fd.get('fixture_id'))
  const roundId = uuid.safeParse(fd.get('round_id'))
  const postponed = fd.get('postponed') === 'true'
  if (!fixtureId.success || !roundId.success) return { error: 'Datos no válidos.' }
  const { supabase } = await requireAdmin()
  const { error } = await supabase
    .from('fixtures')
    .update({ status: postponed ? 'postponed' : 'scheduled' })
    .eq('id', fixtureId.data)
  if (error) return { error: dbError(error) }
  refresh(roundId.data)
  return { success: postponed ? 'Partido marcado como aplazado.' : 'Partido reactivado.' }
}

export async function settleRound(_: FormState, fd: FormData): Promise<FormState> {
  const roundId = uuid.safeParse(fd.get('round_id'))
  if (!roundId.success) return { error: 'Datos no válidos.' }
  const { supabase } = await requireAdmin()
  const { data, error } = await supabase.rpc('admin_settle_round', { p_round_id: roundId.data })
  if (error) return { error: dbError(error) }
  refresh(roundId.data)
  return {
    success:
      data.winners_count === 0
        ? 'Jornada liquidada. Nadie ha acertado: el bote se acumula.'
        : `Jornada liquidada. ${data.winners_count === 1 ? '1 ganador' : `${data.winners_count} ganadores`}.`,
  }
}

export async function voidRound(_: FormState, fd: FormData): Promise<FormState> {
  const roundId = uuid.safeParse(fd.get('round_id'))
  const reason = String(fd.get('reason') ?? '').trim()
  if (!roundId.success) return { error: 'Datos no válidos.' }
  const { supabase } = await requireAdmin()
  const { error } = await supabase.rpc('admin_void_round', { p_round_id: roundId.data, p_reason: reason })
  if (error) return { error: dbError(error) }
  refresh(roundId.data)
  return { success: 'Jornada anulada. Los boletos completos suman al bote.' }
}

export async function reopenRound(_: FormState, fd: FormData): Promise<FormState> {
  const roundId = uuid.safeParse(fd.get('round_id'))
  if (!roundId.success) return { error: 'Datos no válidos.' }
  const { supabase } = await requireAdmin()
  const { error } = await supabase.rpc('admin_reopen_round', { p_round_id: roundId.data })
  if (error) return { error: dbError(error) }
  refresh(roundId.data)
  return { success: 'Jornada reabierta. Corrige lo necesario y vuelve a liquidar.' }
}

// Bote ---------------------------------------------------------------------------------------------
export async function adjustPot(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = z
    .object({
      league_id: uuid,
      amount: z.coerce.number().positive('El importe debe ser mayor que 0.').max(100000),
      direction: z.enum(['add', 'remove']),
      note: z.string().trim().min(3, 'Escribe el motivo del ajuste.').max(200),
    })
    .safeParse({
      league_id: fd.get('league_id'),
      amount: String(fd.get('amount') ?? '').replace(',', '.'),
      direction: fd.get('direction'),
      note: fd.get('note'),
    })
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const cents = Math.round(parsed.data.amount * 100) * (parsed.data.direction === 'add' ? 1 : -1)
  const { supabase } = await requireAdmin()
  const { error } = await supabase.rpc('admin_adjust_pot', { p_league_id: parsed.data.league_id, p_amount_cents: cents, p_note: parsed.data.note })
  if (error) return { error: dbError(error) }
  refresh()
  return { success: 'Ajuste registrado.' }
}
