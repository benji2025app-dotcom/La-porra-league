'use client'

import { useActionState, useEffect, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Lock, Minus, Plus } from 'lucide-react'
import { submitPrediction } from './actions'
import { FormMessage } from '@/components/ui'

function untilText(ms: number) {
  if (ms <= 0) return null
  const min = Math.floor(ms / 60000)
  const d = Math.floor(min / 1440)
  const h = Math.floor((min % 1440) / 60)
  const m = min % 60
  if (d > 0) return `Se cierra en ${d} d ${h} h`
  if (h > 0) return `Se cierra en ${h} h ${m} min`
  return `Se cierra en ${m} min`
}

function Stepper({ team, value, onChange, disabled }: { team: string; value: number | null; onChange: (v: number) => void; disabled: boolean }) {
  const v = value ?? 0
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="line-clamp-2 min-h-[2.5rem] text-center text-sm font-semibold leading-tight">{team}</span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-label={`Un gol menos para ${team}`}
          disabled={disabled || v === 0 || value === null}
          onClick={() => onChange(Math.max(0, v - 1))}
          className="grid size-9 place-items-center rounded-full border border-line text-ivory-muted transition hover:border-gold hover:text-ivory disabled:opacity-30"
        >
          <Minus size={16} aria-hidden />
        </button>
        <output
          aria-label={`Goles de ${team}`}
          className={`w-12 text-center font-display text-[2.6rem] font-bold leading-none tabular-nums ${value === null ? 'text-ivory-muted/40' : 'text-ivory'}`}
        >
          {value ?? '–'}
        </output>
        <button
          type="button"
          aria-label={`Un gol más para ${team}`}
          disabled={disabled || v >= 20}
          onClick={() => onChange(value === null ? 0 : Math.min(20, v + 1))}
          className="grid size-9 place-items-center rounded-full border border-line text-ivory-muted transition hover:border-gold hover:text-ivory disabled:opacity-30"
        >
          <Plus size={16} aria-hidden />
        </button>
      </div>
    </div>
  )
}

function SaveButton({ dirty }: { dirty: boolean }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending || !dirty}
      className="btn-gold w-full rounded-xl px-5 py-3 text-sm font-semibold transition"
    >
      {pending ? 'Guardando…' : dirty ? 'Guardar marcador' : 'Marcador guardado'}
    </button>
  )
}

export function MatchPicker({
  fixtureId,
  homeTeam,
  awayTeam,
  kickoffAt,
  lockedAtLoad,
  saved,
}: {
  fixtureId: string
  homeTeam: string
  awayTeam: string
  kickoffAt: string
  lockedAtLoad: boolean
  saved: { home: number; away: number } | null
}) {
  const [state, action] = useActionState(submitPrediction, undefined)
  const [home, setHome] = useState<number | null>(saved?.home ?? null)
  const [away, setAway] = useState<number | null>(saved?.away ?? null)
  const [now, setNow] = useState<number | null>(null)

  useEffect(() => {
    const tick = () => setNow(Date.now())
    tick()
    const id = setInterval(tick, 30000)
    return () => clearInterval(id)
  }, [])

  const msLeft = now === null ? null : new Date(kickoffAt).getTime() - now
  const locked = lockedAtLoad || (msLeft !== null && msLeft <= 0)
  // Tras guardar, la acción revalida la página y `saved` llega actualizado desde el servidor.
  const dirty = home !== null && away !== null && (saved?.home !== home || saved?.away !== away)

  if (locked) {
    return (
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 text-xs text-ivory-muted">
          <Lock size={13} aria-hidden /> Bloqueado
        </span>
        <span className="font-display text-2xl font-bold tabular-nums">
          {saved ? `${saved.home}–${saved.away}` : <span className="text-sm font-normal text-danger">Sin pronóstico</span>}
        </span>
      </div>
    )
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="fixture_id" value={fixtureId} />
      <input type="hidden" name="home" value={home ?? ''} />
      <input type="hidden" name="away" value={away ?? ''} />
      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-1">
        <Stepper team={homeTeam} value={home} onChange={setHome} disabled={false} />
        <span aria-hidden className="pb-2 font-display text-2xl text-gold">:</span>
        <Stepper team={awayTeam} value={away} onChange={setAway} disabled={false} />
      </div>
      <SaveButton dirty={dirty} />
      <FormMessage error={state?.error} success={state?.success && !dirty ? state.success : undefined} />
      {msLeft !== null && <p className="text-center text-xs text-ivory-muted">{untilText(msLeft)}. Hasta entonces puedes cambiarlo.</p>}
    </form>
  )
}
