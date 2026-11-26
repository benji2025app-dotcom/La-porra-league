'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import type { FormState } from '@/app/(auth)/actions'

export async function updateDisplayName(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .string()
    .trim()
    .min(2, 'Tu nombre necesita al menos 2 caracteres.')
    .max(30, 'Tu nombre admite como máximo 30 caracteres.')
    .safeParse(formData.get('display_name'))
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { supabase, user } = await getSession()
  if (!user) return { error: 'Tu sesión ha caducado. Vuelve a entrar.' }
  const { error } = await supabase.rpc('update_my_display_name', { p_display_name: parsed.data })
  if (error) return { error: 'No se ha podido guardar el nombre.' }
  revalidatePath('/', 'layout')
  return { success: 'Nombre guardado.' }
}
