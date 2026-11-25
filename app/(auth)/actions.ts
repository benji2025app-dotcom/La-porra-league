'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { siteOrigin } from '@/lib/env'

export type FormState = { error?: string; success?: string; fields?: Record<string, string> } | undefined

const email = z.email('Escribe un correo válido.').trim().toLowerCase()
const password = z
  .string()
  .min(8, 'La contraseña necesita al menos 8 caracteres.')
  .max(72, 'La contraseña admite como máximo 72 caracteres.')

function authMessage(message: string) {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials')) return 'Correo o contraseña incorrectos.'
  if (m.includes('email not confirmed')) return 'Confirma tu correo antes de entrar. Revisa tu bandeja de entrada.'
  if (m.includes('rate limit') || m.includes('too many')) return 'Demasiados intentos. Espera unos minutos y vuelve a probar.'
  if (m.includes('database error saving new user')) return 'El código de invitación no es válido o ha caducado.'
  if (m.includes('password')) return 'La contraseña no cumple los requisitos de seguridad.'
  return 'No se ha podido completar la operación. Inténtalo de nuevo.'
}

export async function login(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = z.object({ email, password: z.string().min(1, 'Escribe tu contraseña.') }).safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })
  const fields = { email: String(formData.get('email') ?? '') }
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) return { error: authMessage(error.message), fields }
  redirect('/')
}

export async function register(_: FormState, formData: FormData): Promise<FormState> {
  const raw = {
    display_name: String(formData.get('display_name') ?? ''),
    email: String(formData.get('email') ?? ''),
    invite_code: String(formData.get('invite_code') ?? ''),
  }
  const parsed = z
    .object({
      display_name: z.string().trim().min(2, 'Tu nombre necesita al menos 2 caracteres.').max(30, 'Tu nombre admite como máximo 30 caracteres.'),
      email,
      password,
      invite_code: z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z0-9-]{6,32}$/, 'Escribe el código de invitación que te ha pasado el administrador.'),
    })
    .safeParse({ ...raw, password: formData.get('password') })
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields: raw }

  const supabase = await createClient()
  const { data: valid } = await supabase.rpc('check_invite_code', { p_code: parsed.data.invite_code })
  if (!valid) return { error: 'El código de invitación no es válido o ha caducado.', fields: raw }

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${await siteOrigin()}/auth/confirm?next=/`,
      data: { display_name: parsed.data.display_name, invite_code: parsed.data.invite_code },
    },
  })
  if (error) return { error: authMessage(error.message), fields: raw }
  if (data.session) redirect('/pendiente')

  return {
    success: `Te hemos enviado un correo a ${parsed.data.email}. Ábrelo para confirmar tu cuenta; después el administrador aprobará tu acceso.`,
  }
}

export async function requestPasswordReset(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = email.safeParse(formData.get('email'))
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${await siteOrigin()}/auth/confirm?next=/nueva-contrasena`,
  })
  // Mismo mensaje exista o no la cuenta (no revelamos qué correos están registrados).
  return { success: 'Si ese correo tiene cuenta, recibirás un enlace para crear una contraseña nueva.' }
}

export async function updatePassword(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .object({ password, confirm: z.string() })
    .refine((v) => v.password === v.confirm, { message: 'Las dos contraseñas no coinciden.' })
    .safeParse({ password: formData.get('password'), confirm: formData.get('confirm') })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'El enlace ha caducado. Pide uno nuevo desde "He olvidado mi contraseña".' }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (error) return { error: authMessage(error.message) }
  redirect('/')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
