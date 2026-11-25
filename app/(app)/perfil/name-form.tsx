'use client'

import { useActionState } from 'react'
import { updateDisplayName } from './actions'
import { Field, FormMessage, SubmitButton } from '@/components/ui'

export function NameForm({ current }: { current: string }) {
  const [state, action] = useActionState(updateDisplayName, undefined)
  return (
    <form action={action} className="space-y-3" noValidate>
      <Field label="Tu nombre en la porra" name="display_name" defaultValue={current} maxLength={30} required />
      <FormMessage error={state?.error} success={state?.success} />
      <SubmitButton pendingText="Guardando…">Guardar nombre</SubmitButton>
    </form>
  )
}
