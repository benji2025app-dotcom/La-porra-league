import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/auth'
import { money } from '@/lib/format'
import { ActionForm } from '@/components/action-form'
import { Field } from '@/components/ui'
import { adjustPot } from '../actions'

export const metadata: Metadata = { title: 'Bote' }

const KIND: Record<string, string> = { contribution: 'Boletos', payout: 'Premio', adjustment: 'Ajuste' }
const fmt = (iso: string) =>
  new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' }).format(
    new Date(iso),
  )

export default async function PotPage() {
  const { supabase, league } = await requireAdmin()
  const [{ data: balance }, { data: moves }] = await Promise.all([
    supabase.rpc('get_pot_balance', { p_league_id: league.id }),
    supabase
      .from('pot_movements')
      .select('id, kind, amount_cents, note, created_at, rounds(name), profiles!pot_movements_user_id_fkey(display_name)')
      .eq('league_id', league.id)
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  return (
    <div className="space-y-8">
      <div className="gold-frame px-5 py-4">
        <p className="text-sm text-ivory-muted">Bote acumulado de {league.name}</p>
        <p className="font-display text-3xl font-bold text-gold-bright tabular-nums">{money(balance ?? 0)}</p>
      </div>

      <section className="rounded-2xl border border-line bg-carbon-2 p-4">
        <h2 className="font-display text-lg font-semibold">Ajuste manual</h2>
        <p className="mb-3 mt-1 text-xs text-ivory-muted">Para cuadrar el bote con la realidad (por ejemplo, un bote inicial). Queda registrado con su motivo.</p>
        <ActionForm action={adjustPot} label="Registrar ajuste" confirm="Confirmar ajuste">
          <input type="hidden" name="league_id" value={league.id} />
          <fieldset className="grid grid-cols-2 gap-2 text-sm">
            <legend className="sr-only">Tipo de ajuste</legend>
            <label className="flex items-center gap-2 rounded-xl border border-line px-3 py-2.5">
              <input type="radio" name="direction" value="add" defaultChecked className="accent-[#c8a04b]" /> Sumar
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-line px-3 py-2.5">
              <input type="radio" name="direction" value="remove" className="accent-[#c8a04b]" /> Restar
            </label>
          </fieldset>
          <Field label="Importe (€)" name="amount" inputMode="decimal" placeholder="12,00" required />
          <Field label="Motivo" name="note" maxLength={200} placeholder="Bote inicial de la temporada" required />
        </ActionForm>
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold">Movimientos</h2>
        {(moves ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-ivory-muted">Sin movimientos todavía.</p>
        ) : (
          <ul className="mt-2 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-carbon-2 text-sm">
            {moves!.map((m) => (
              <li key={m.id} className="flex items-start justify-between gap-3 px-4 py-3">
                <span className="min-w-0">
                  <span className="block font-medium">
                    {KIND[m.kind]}
                    {m.rounds?.name ? `, ${m.rounds.name}` : ''}
                    {m.profiles?.display_name ? `, ${m.profiles.display_name}` : ''}
                  </span>
                  <span className="block truncate text-xs text-ivory-muted">
                    {fmt(m.created_at)}
                    {m.note ? `. ${m.note}` : ''}
                  </span>
                </span>
                <span className={`shrink-0 tabular-nums ${m.amount_cents >= 0 ? 'text-ok' : 'text-[#f3b7ad]'}`}>
                  {m.amount_cents >= 0 ? '+' : ''}
                  {money(m.amount_cents)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
