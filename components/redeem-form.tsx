'use client'

import { useActionState } from 'react'
import { redeemInviteCode } from '@/app/(auth)/actions'
import { Field, FormMessage, SubmitButton } from '@/components/ui'

export function RedeemForm({ label = 'Validar código' }: { label?: string }) {
  const [state, action] = useActionState(redeemInviteCode, undefined)
  return (
    <form action={action} className="w-full space-y-4 text-left" noValidate>
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
      <FormMessage error={state?.error} success={state?.success} />
      <SubmitButton pendingText="Comprobando…">{label}</SubmitButton>
    </form>
  )
}
