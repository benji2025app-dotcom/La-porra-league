'use client'

import { useFormStatus } from 'react-dom'
import type { ComponentProps, ReactNode } from 'react'

export function SubmitButton({ children, pendingText, className = '' }: { children: ReactNode; pendingText: string; className?: string }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`btn-gold w-full rounded-xl px-5 py-3.5 text-[0.95rem] font-semibold transition ${className}`}
    >
      {pending ? pendingText : children}
    </button>
  )
}

export function Field({ label, hint, ...props }: ComponentProps<'input'> & { label: string; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ivory">{label}</span>
      <input className="field" {...props} />
      {hint && <span className="mt-1.5 block text-xs text-ivory-muted">{hint}</span>}
    </label>
  )
}

export function FormMessage({ error, success }: { error?: string; success?: string }) {
  if (error)
    return (
      <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-[#f3b7ad]">
        {error}
      </p>
    )
  if (success)
    return (
      <p role="status" className="rounded-xl border border-ok/40 bg-ok/10 px-4 py-3 text-sm text-[#c4ead2]">
        {success}
      </p>
    )
  return null
}
