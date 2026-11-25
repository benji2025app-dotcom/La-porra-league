'use client'

import { useActionState, useState, type ReactNode } from 'react'
import { useFormStatus } from 'react-dom'
import type { FormState } from '@/app/(auth)/actions'
import { FormMessage } from '@/components/ui'

type Action = (state: FormState, formData: FormData) => Promise<FormState>

type Variant = 'gold' | 'outline' | 'danger'

const VARIANTS: Record<Variant, string> = {
  gold: 'btn-gold',
  outline: 'border border-line text-ivory hover:border-gold/60',
  danger: 'border border-danger/50 text-[#f3b7ad] hover:bg-danger/10',
}

function Submit({ label, pending, variant, armed }: { label: string; pending: string; variant: Variant; armed?: boolean }) {
  const status = useFormStatus()
  return (
    <button
      type="submit"
      disabled={status.pending}
      className={`w-full rounded-xl px-4 py-3 text-sm font-semibold transition ${armed ? VARIANTS.danger + ' bg-danger/15' : VARIANTS[variant]}`}
    >
      {status.pending ? pending : label}
    </button>
  )
}

/**
 * Formulario genérico para acciones de servidor con mensaje de resultado.
 * Con `confirm`, el primer toque arma el botón y el segundo ejecuta (sin diálogos del navegador).
 */
export function ActionForm({
  action,
  children,
  label,
  pending = 'Guardando…',
  confirm,
  variant = 'gold',
  className = '',
}: {
  action: Action
  children?: ReactNode
  label: string
  pending?: string
  confirm?: string
  variant?: Variant
  className?: string
}) {
  const [state, formAction] = useActionState(action, undefined)
  const [armed, setArmed] = useState(false)

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (confirm && !armed) {
          e.preventDefault()
          setArmed(true)
        } else {
          setArmed(false)
        }
      }}
      className={`space-y-3 ${className}`}
      noValidate
    >
      {children}
      <FormMessage error={state?.error} success={state?.success} />
      <Submit label={armed && confirm ? confirm : label} pending={pending} variant={variant} armed={armed} />
      {armed && (
        <button type="button" onClick={() => setArmed(false)} className="w-full text-xs text-ivory-muted underline-offset-4 hover:underline">
          Cancelar
        </button>
      )}
    </form>
  )
}
