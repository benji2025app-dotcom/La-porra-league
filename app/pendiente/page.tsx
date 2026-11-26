import type { Metadata } from 'next'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { logout } from '@/app/(auth)/actions'
import { RedeemForm } from '@/components/redeem-form'

export const metadata: Metadata = { title: 'Pendiente de aprobación' }

export default async function PendingPage() {
  const { supabase, user, profile } = await getSession()
  if (!user) redirect('/login')

  const blocked = profile?.status === 'blocked'
  const { data: memberships } = await supabase
    .from('league_members')
    .select('status, leagues(name)')
    .eq('user_id', user.id)
  const active = (memberships ?? []).filter((m) => m.status === 'active')
  if (!blocked && (active.length > 0 || profile?.role === 'admin')) redirect('/')
  const pending = (memberships ?? []).filter((m) => m.status === 'pending')

  return (
    <main className="mx-auto flex min-h-dvh max-w-[26rem] flex-col items-center px-5 pb-10 pt-[max(2.5rem,env(safe-area-inset-top))] text-center">
      <Image src="/brand/logo-640.png" alt="La Porra League" width={640} height={640} priority className="h-auto w-36 rounded-[22%]" />
      <h1 className="mt-8 font-display text-2xl font-semibold">
        {blocked ? 'Acceso desactivado' : `Hola, ${profile?.display_name ?? 'jugador'}`}
      </h1>
      {blocked ? (
        <p className="mt-3 text-ivory-muted">El administrador ha desactivado tu cuenta. Habla con él si crees que es un error.</p>
      ) : pending.length > 0 ? (
        <p className="mt-3 text-ivory-muted">
          Tu solicitud para {pending.map((m) => m.leagues?.name).join(' y ')} está pendiente. En cuanto el administrador te apruebe, entra de
          nuevo y podrás rellenar tu boleto.
        </p>
      ) : (
        <p className="mt-3 text-ivory-muted">Para unirte a una porra, escribe el código de invitación que te ha pasado el administrador.</p>
      )}
      {!blocked && (
        <div className="mt-7 w-full">
          {pending.length > 0 && <p className="mb-3 text-left text-sm text-ivory-muted">¿Tienes el código de otra porra?</p>}
          <RedeemForm />
        </div>
      )}
      <form action={logout} className="mt-8 w-full">
        <button type="submit" className="w-full rounded-xl border border-line px-5 py-3.5 text-sm font-semibold text-ivory-muted hover:text-ivory">
          Cerrar sesión
        </button>
      </form>
    </main>
  )
}
