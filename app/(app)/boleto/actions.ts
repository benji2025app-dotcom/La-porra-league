'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireLeague } from '@/lib/auth'
import { dbError } from '@/lib/errors'
import type { FormState } from '@/app/(auth)/actions'

const score = z.coerce.number().int().min(0).max(20)

export async function submitPrediction(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = z
    .object({ fixture_id: z.uuid(), home: score, away: score })
    .safeParse({ fixture_id: fd.get('fixture_id'), home: fd.get('home'), away: fd.get('away') })
  if (!parsed.success) return { error: 'Elige un marcador entre 0 y 20 para cada equipo.' }

  // La autorización y el bloqueo por hora los valida la base de datos (hora del servidor).
  const { supabase } = await requireLeague()
  const { error } = await supabase.rpc('submit_prediction', {
    p_fixture_id: parsed.data.fixture_id,
    p_home_goals: parsed.data.home,
    p_away_goals: parsed.data.away,
  })
  if (error) return { error: dbError(error) }
  revalidatePath('/', 'layout')
  return { success: `Guardado: ${parsed.data.home}–${parsed.data.away}` }
}
