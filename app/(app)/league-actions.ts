'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { LEAGUE_COOKIE, getLeagueContext } from '@/lib/auth'
import { safeNext } from '@/lib/format'

export async function selectLeague(formData: FormData) {
  const id = z.uuid().safeParse(formData.get('league_id'))
  const { leagues } = await getLeagueContext()
  if (id.success && leagues.some((l) => l.id === id.data)) {
    ;(await cookies()).set(LEAGUE_COOKIE, id.data, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    })
  }
  const next = safeNext(String(formData.get('next') ?? '/'))
  // Las páginas de detalle pertenecen a una porra concreta: volvemos a la sección.
  redirect(next.replace(/^\/(calendario|admin\/jornadas)\/[^/]+$/, '/$1'))
}
