'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { login } from '../actions'
import { Field, FormMessage, SubmitButton } from '@/components/ui'
import { GoogleButton, OrDivider } from '@/components/google-button'

export function LoginForm({ notice }: { notice?: string }) {
  const [state, action] = useActionState(login, undefined)
  return (
    <section>
      <h1 className="font-display text-[1.7rem] font-semibold leading-tight text-ivory">Entra en la porra</h1>
      <p className="mt-2 text-ivory-muted">Dos marcadores por jornada. Acierta los dos y el bote es tuyo.</p>

      <div className="mt-7">
        {notice && !state && (
          <div className="mb-4">
            <FormMessage success={notice} />
          </div>
        )}
        <GoogleButton />
      </div>
      <OrDivider />
      <form action={action} className="space-y-4" noValidate>
        <Field label="Correo" name="email" type="email" autoComplete="email" inputMode="email" required defaultValue={state?.fields?.email} />
        <Field label="Contraseña" name="password" type="password" autoComplete="current-password" required />
        <FormMessage error={state?.error} />
        <SubmitButton pendingText="Entrando…">Entrar</SubmitButton>
      </form>

      <div className="mt-6 flex flex-col items-center gap-3 text-sm">
        <Link href="/recuperar" className="text-ivory-muted underline-offset-4 hover:text-ivory hover:underline">
          He olvidado mi contraseña
        </Link>
        <p className="text-ivory-muted">
          ¿Tienes un código de invitación?{' '}
          <Link href="/registro" className="font-semibold text-gold-bright underline-offset-4 hover:underline">
            Crea tu cuenta
          </Link>
        </p>
      </div>
    </section>
  )
}
