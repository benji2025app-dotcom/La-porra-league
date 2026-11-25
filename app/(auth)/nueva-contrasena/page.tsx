'use client'

import { useActionState } from 'react'
import { updatePassword } from '../actions'
import { Field, FormMessage, SubmitButton } from '@/components/ui'

export default function NewPasswordPage() {
  const [state, action] = useActionState(updatePassword, undefined)
  return (
    <section>
      <h1 className="font-display text-[1.7rem] font-semibold leading-tight">Elige tu contraseña</h1>
      <form action={action} className="mt-7 space-y-4" noValidate>
        <Field label="Contraseña nueva" name="password" type="password" autoComplete="new-password" minLength={8} required hint="Mínimo 8 caracteres." />
        <Field label="Repite la contraseña" name="confirm" type="password" autoComplete="new-password" required />
        <FormMessage error={state?.error} />
        <SubmitButton pendingText="Guardando…">Guardar contraseña</SubmitButton>
      </form>
    </section>
  )
}
