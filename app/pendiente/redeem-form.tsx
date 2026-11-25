'use client'

import { useActionState } from 'react'
import { redeemInviteCode } from '@/app/(auth)/actions'
import { Field, FormMessage, SubmitButton } from '@/components/ui'

export function RedeemForm() {
  const [state, action] = useActionState(redeemInviteCode, undefined)
  return (
    <form action={action} className="mt-7 w-full space-y-4 text-left" noValidate>
      <Field
        label="Código de invitación"
        name="invite_code"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        placeholder="PORRA-XXXXXXXX"
        required
        className="field font-mono uppercase tracking-wider"
      />
      <FormMessage error={state?.error} />
      <SubmitButton pendingText="Comprobando…">Validar código</SubmitButton>
    </form>
  )
}
