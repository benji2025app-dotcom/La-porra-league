import type { Metadata } from 'next'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { logout } from '@/app/(auth)/actions'

export const metadata: Metadata = { title: 'Pendiente de aprobación' }

export default async function PendingPage() {
  const { user, profile } = await getSession()
  if (!user) redirect('/login')
  if (profile?.status === 'active') redirect('/')

  const blocked = profile?.status === 'blocked'

  return (
    <main className="mx-auto flex min-h-dvh max-w-[26rem] flex-col items-center px-5 pt-[max(2.5rem,env(safe-area-inset-top))] text-center">
      <Image src="/brand/logo-640.png" alt="La Porra League" width={640} height={640} priority className="h-auto w-36 rounded-[22%]" />
      <h1 className="mt-8 font-display text-2xl font-semibold">
        {blocked ? 'Acceso desactivado' : `Hola, ${profile?.display_name ?? 'jugador'}`}
      </h1>
      <p className="mt-3 text-ivory-muted">
        {blocked
          ? 'El administrador ha desactivado tu cuenta. Habla con él si crees que es un error.'
          : 'Tu cuenta está creada. Falta que el administrador apruebe tu acceso; en cuanto lo haga, entra de nuevo y podrás rellenar tu boleto.'}
      </p>
      <form action={logout} className="mt-8 w-full">
        <button type="submit" className="w-full rounded-xl border border-line px-5 py-3.5 text-sm font-semibold text-ivory-muted hover:text-ivory">
          Cerrar sesión
        </button>
      </form>
    </main>
  )
}
