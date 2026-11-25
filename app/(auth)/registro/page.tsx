'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { register } from '../actions'
import { Field, FormMessage, SubmitButton } from '@/components/ui'

export default function RegisterPage() {
  const [state, action] = useActionState(register, undefined)

  if (state?.success) {
    return (
      <section>
        <h1 className="font-display text-[1.7rem] font-semibold leading-tight">Revisa tu correo</h1>
        <div className="mt-5">
          <FormMessage success={state.success} />
        </div>
        <Link href="/login" className="mt-6 block text-center text-sm font-semibold text-gold-bright underline-offset-4 hover:underline">
          Volver a entrar
        </Link>
      </section>
    )
  }

  return (
    <section>
      <h1 className="font-display text-[1.7rem] font-semibold leading-tight">Crea tu cuenta</h1>
      <p className="mt-2 text-ivory-muted">Necesitas el código que te ha pasado el administrador. Cuando apruebe tu acceso, podrás jugar.</p>

      <form action={action} className="mt-7 space-y-4" noValidate>
        <Field
          label="Código de invitación"
          name="invite_code"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="PORRA-XXXXXXXX"
          required
          defaultValue={state?.fields?.invite_code}
          className="field font-mono uppercase tracking-wider"
        />
        <Field
          label="Tu nombre en la porra"
          name="display_name"
          autoComplete="nickname"
          maxLength={30}
          required
          hint="Es el nombre que verán los demás en la clasificación."
          defaultValue={state?.fields?.display_name}
        />
        <Field label="Correo" name="email" type="email" autoComplete="email" inputMode="email" required defaultValue={state?.fields?.email} />
        <Field label="Contraseña" name="password" type="password" autoComplete="new-password" minLength={8} required hint="Mínimo 8 caracteres." />
        <FormMessage error={state?.error} />
        <SubmitButton pendingText="Creando tu cuenta…">Crear cuenta</SubmitButton>
      </form>

      <p className="mt-6 text-center text-sm text-ivory-muted">
        ¿Ya tienes cuenta?{' '}
        <Link href="/login" className="font-semibold text-gold-bright underline-offset-4 hover:underline">
          Entra
        </Link>
      </p>
    </section>
  )
}
