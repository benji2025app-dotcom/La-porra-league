'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { dbError } from '@/lib/errors'
import { madridLocalToIso } from '@/lib/time'
import type { FormState } from '@/app/(auth)/actions'

const uuid = z.uuid()
const goals = z.coerce.number().int().min(0, 'Goles entre 0 y 30.').max(30, 'Goles entre 0 y 30.')

function refresh(roundId?: string) {
  revalidatePath('/', 'layout')
  if (roundId) revalidatePath(`/admin/jornadas/${roundId}`)
}

// Jugadores ------------------------------------------------------------------------
export async function setMemberStatus(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = z
    .object({ user_id: uuid, status: z.enum(['active', 'blocked', 'pending']) })
    .safeParse({ user_id: fd.get('user_id'), status: fd.get('status') })
  if (!parsed.success) return { error: 'Datos no válidos.' }
  const { supabase } = await requireAdmin()
  const { error } = await supabase.rpc('admin_set_member_status', { p_user_id: parsed.data.user_id, p_status: parsed.data.status })
  if (error) return { error: dbError(error) }
  refresh()
  return { success: parsed.data.status === 'active' ? 'Jugador aprobado.' : 'Estado actualizado.' }
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
      note: z.string().trim().max(80).optional(),
      max_uses: z.coerce.number().int().min(1).max(100),
      days: z.coerce.number().int().min(1).max(90),
    })
    .safeParse({ note: fd.get('note') || undefined, max_uses: fd.get('max_uses'), days: fd.get('days') })
  if (!parsed.success) return { error: 'Revisa los usos (1-100) y los días de validez (1-90).' }
  const { supabase } = await requireAdmin()
  const expires = new Date(Date.now() + parsed.data.days * 86400000).toISOString()
  const { data, error } = await supabase.rpc('admin_create_invite_code', {
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

// Jornadas -------------------------------------------------------------------------
export async function createRound(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = z
    .object({ number: z.coerce.number().int().min(1).max(999), name: z.string().trim().max(60).optional() })
    .safeParse({ number: fd.get('number'), name: fd.get('name') || undefined })
  if (!parsed.success) return { error: 'Número de jornada no válido.' }
  const { supabase } = await requireAdmin()
  const { data: season } = await supabase.from('seasons').select('id').eq('is_active', true).single()
  if (!season) return { error: 'No hay temporada activa.' }
  const { data, error } = await supabase
    .from('rounds')
    .insert({ season_id: season.id, number: parsed.data.number, name: parsed.data.name || `Jornada ${parsed.data.number}` })
    .select('id')
    .single()
  if (error) return { error: dbError(error) }
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
  club: z.enum(['barcelona', 'real_madrid']),
  competition: z.string().trim().min(2, 'Escribe la competición.').max(60),
  home_team: z.string().trim().min(2, 'Escribe el equipo local.').max(60),
  away_team: z.string().trim().min(2, 'Escribe el equipo visitante.').max(60),
  kickoff: z.string(),
})

function readFixture(fd: FormData) {
  return fixtureSchema.safeParse({
    round_id: fd.get('round_id'),
    club: fd.get('club'),
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
  const values = {
    competition: parsed.data.competition,
    home_team: parsed.data.home_team,
    away_team: parsed.data.away_team,
    kickoff_at: kickoffIso,
  }
  const { error } = fixtureId
    ? await supabase.from('fixtures').update(values).eq('id', fixtureId)
    : await supabase.from('fixtures').insert({ ...values, round_id: parsed.data.round_id, club: parsed.data.club })
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
  const { error } = await supabase.rpc('admin_replace_fixture', {
    p_fixture_id: fixtureId.data,
    p_competition: parsed.data.competition,
    p_home_team: parsed.data.home_team,
    p_away_team: parsed.data.away_team,
    p_kickoff_at: kickoffIso,
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

// Bote ---------------------------------------------------------------------------------
export async function adjustPot(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = z
    .object({
      amount: z.coerce.number().positive('El importe debe ser mayor que 0.').max(100000),
      direction: z.enum(['add', 'remove']),
      note: z.string().trim().min(3, 'Escribe el motivo del ajuste.').max(200),
    })
    .safeParse({ amount: String(fd.get('amount') ?? '').replace(',', '.'), direction: fd.get('direction'), note: fd.get('note') })
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const cents = Math.round(parsed.data.amount * 100) * (parsed.data.direction === 'add' ? 1 : -1)
  const { supabase } = await requireAdmin()
  const { error } = await supabase.rpc('admin_adjust_pot', { p_amount_cents: cents, p_note: parsed.data.note })
  if (error) return { error: dbError(error) }
  refresh()
  return { success: 'Ajuste registrado.' }
}
