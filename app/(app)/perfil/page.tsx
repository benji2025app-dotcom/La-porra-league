import type { Metadata } from 'next'
import Link from 'next/link'
import { LogOut, ShieldCheck } from 'lucide-react'
import { requireLeague } from '@/lib/auth'
import { logout } from '@/app/(auth)/actions'
import { RedeemForm } from '@/components/redeem-form'
import { Crest } from '@/components/crest'
import { NameForm } from './name-form'

export const metadata: Metadata = { title: 'Perfil' }

const STATUS: Record<string, string> = { active: 'Jugando', pending: 'Pendiente de aprobación', blocked: 'Fuera' }

export default async function ProfilePage() {
  const { supabase, user, profile, isAdmin } = await requireLeague()
  const { data: memberships } = await supabase
    .from('league_members')
    .select(
      'league_id, status, leagues(name, club_a:teams!leagues_club_a_id_fkey(name, short_name, crest_url), club_b:teams!leagues_club_b_id_fkey(name, short_name, crest_url))',
    )
    .eq('user_id', user.id)

  return (
    <div className="space-y-8">
      <section>
        <h1 className="font-display text-2xl font-semibold">Perfil</h1>
        <p className="mt-1 text-sm text-ivory-muted">{user.email}</p>
      </section>

      {isAdmin && (
        <Link href="/admin" className="gold-frame flex items-center gap-3 px-5 py-4">
          <ShieldCheck className="text-gold-bright" aria-hidden />
          <span className="flex-1">
            <span className="block font-semibold">Panel de administración</span>
            <span className="block text-sm text-ivory-muted">Porras, jugadores, jornadas, resultados y bote</span>
          </span>
        </Link>
      )}

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Mis porras</h2>
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-carbon-2">
          {(memberships ?? []).map((m) => (
            <li key={m.league_id} className="flex items-center gap-3 px-4 py-3">
              <span className="flex -space-x-1.5">
                <Crest team={m.leagues?.club_a} size={22} />
                <Crest team={m.leagues?.club_b} size={22} />
              </span>
              <span className="flex-1 font-semibold">{m.leagues?.name}</span>
              <span className={`text-xs ${m.status === 'active' ? 'text-ok' : 'text-ivory-muted'}`}>{STATUS[m.status]}</span>
            </li>
          ))}
        </ul>
        <details className="rounded-2xl border border-line bg-carbon-2 p-4">
          <summary className="cursor-pointer text-sm font-semibold">Unirme a otra porra</summary>
          <div className="mt-4">
            <RedeemForm label="Unirme" />
          </div>
        </details>
      </section>

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
