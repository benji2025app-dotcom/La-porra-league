import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Tables } from '@/lib/database.types'

export type Profile = Pick<Tables<'profiles'>, 'id' | 'display_name' | 'role' | 'status'>

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

// Exige un participante aprobado. Redirige en cualquier otro caso.
export async function requireMember() {
  const session = await getSession()
  if (!session.user) redirect('/login')
  if (!session.profile || session.profile.status !== 'active') redirect('/pendiente')
  return { supabase: session.supabase, user: session.user, profile: session.profile }
}

export async function requireAdmin() {
  const session = await requireMember()
  if (session.profile.role !== 'admin') redirect('/')
  return session
}
