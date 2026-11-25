'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { requestPasswordReset } from '../actions'
import { Field, FormMessage, SubmitButton } from '@/components/ui'

export function RecoverForm({ expired }: { expired: boolean }) {
  const [state, action] = useActionState(requestPasswordReset, undefined)

  return (
    <section>
      <h1 className="font-display text-[1.7rem] font-semibold leading-tight">Nueva contraseña</h1>
      <p className="mt-2 text-ivory-muted">Te enviamos un enlace al correo para que elijas otra.</p>

      {state?.success ? (
        <div className="mt-7">
          <FormMessage success={state.success} />
        </div>
      ) : (
        <form action={action} className="mt-7 space-y-4" noValidate>
          {expired && !state && <FormMessage error="El enlace ha caducado o se abrió en otro navegador. Pide uno nuevo." />}
          <Field label="Correo" name="email" type="email" autoComplete="email" inputMode="email" required />
          <FormMessage error={state?.error} />
          <SubmitButton pendingText="Enviando…">Enviar enlace</SubmitButton>
        </form>
      )}

      <Link href="/login" className="mt-6 block text-center text-sm font-semibold text-gold-bright underline-offset-4 hover:underline">
        Volver a entrar
      </Link>
    </section>
  )
}
