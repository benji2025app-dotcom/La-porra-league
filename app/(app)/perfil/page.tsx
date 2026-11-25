import type { Metadata } from 'next'
import Link from 'next/link'
import { LogOut, ShieldCheck } from 'lucide-react'
import { requireMember } from '@/lib/auth'
import { logout } from '@/app/(auth)/actions'
import { NameForm } from './name-form'

export const metadata: Metadata = { title: 'Perfil' }

export default async function ProfilePage() {
  const { user, profile } = await requireMember()
  return (
    <div className="space-y-8">
      <section>
        <h1 className="font-display text-2xl font-semibold">Perfil</h1>
        <p className="mt-1 text-sm text-ivory-muted">{user.email}</p>
      </section>

      {profile.role === 'admin' && (
        <Link href="/admin" className="gold-frame flex items-center gap-3 px-5 py-4">
          <ShieldCheck className="text-gold-bright" aria-hidden />
          <span className="flex-1">
            <span className="block font-semibold">Panel de administración</span>
            <span className="block text-sm text-ivory-muted">Jugadores, jornadas, resultados y bote</span>
          </span>
        </Link>
      )}

      <section className="rounded-2xl border border-line bg-carbon-2 p-5">
        <NameForm current={profile.display_name} />
      </section>

      <form action={logout}>
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-line px-5 py-3.5 text-sm font-semibold text-ivory-muted hover:border-ivory/40 hover:text-ivory"
        >
          <LogOut size={17} aria-hidden /> Cerrar sesión
        </button>
      </form>
    </div>
  )
}
