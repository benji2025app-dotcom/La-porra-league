import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { requireAdmin } from '@/lib/auth'
import { ActionForm } from '@/components/action-form'
import { Field } from '@/components/ui'
import { RoundStatus } from '@/components/round-status'
import { createRound } from '../actions'

export const metadata: Metadata = { title: 'Jornadas' }

export default async function AdminRoundsPage() {
  const { supabase } = await requireAdmin()
  const { data: rounds } = await supabase.from('rounds').select('id, name, number, status').order('number', { ascending: false })
  const next = (rounds?.[0]?.number ?? 0) + 1

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-line bg-carbon-2 p-4">
        <h2 className="mb-3 font-display text-lg font-semibold">Nueva jornada</h2>
        <ActionForm action={createRound} label="Crear jornada" pending="Creando…">
          <div className="grid grid-cols-[6rem_1fr] gap-3">
            <Field label="Número" name="number" type="number" inputMode="numeric" min={1} defaultValue={next} required />
            <Field label="Nombre (opcional)" name="name" maxLength={60} placeholder={`Jornada ${next}`} />
          </div>
        </ActionForm>
        <p className="mt-2 text-xs text-ivory-muted">Se crea en borrador. Añade los dos partidos y publícala para que se pueda pronosticar.</p>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-semibold">Todas las jornadas</h2>
        {(rounds ?? []).length === 0 && <p className="text-sm text-ivory-muted">Aún no hay jornadas.</p>}
        {(rounds ?? []).map((r) => (
          <Link
            key={r.id}
            href={`/admin/jornadas/${r.id}`}
            className="flex items-center gap-3 rounded-2xl border border-line bg-carbon-2 px-4 py-3.5 hover:border-gold/50"
          >
            <span className="flex-1 font-semibold">{r.name}</span>
            <RoundStatus status={r.status} />
            <ChevronRight size={18} aria-hidden className="text-ivory-muted" />
          </Link>
        ))}
      </section>
    </div>
  )
}
