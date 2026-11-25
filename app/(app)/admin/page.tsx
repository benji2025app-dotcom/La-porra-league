import { serverNow } from '@/lib/time'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { requireAdmin } from '@/lib/auth'
import { money } from '@/lib/format'
import { RoundStatus } from '@/components/round-status'

export const metadata: Metadata = { title: 'Administración' }

export default async function AdminHome() {
  const { supabase } = await requireAdmin()
  const [{ data: members }, { data: balance }, { data: rounds }] = await Promise.all([
    supabase.rpc('admin_list_members'),
    supabase.rpc('get_pot_balance'),
    supabase
      .from('rounds')
      .select('id, name, number, status, fixtures(id, status, home_goals, kickoff_at)')
      .in('status', ['draft', 'open'])
      .order('number'),
  ])

  const pending = (members ?? []).filter((m) => m.status === 'pending')
  const active = (members ?? []).filter((m) => m.status === 'active').length
  const now = serverNow()

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        <div className="gold-frame px-4 py-4">
          <p className="text-xs text-ivory-muted">Bote acumulado</p>
          <p className="mt-1 font-display text-2xl font-bold text-gold-bright tabular-nums">{money(balance ?? 0)}</p>
        </div>
        <div className="rounded-[18px] border border-line bg-carbon-2 px-4 py-4">
          <p className="text-xs text-ivory-muted">Jugadores activos</p>
          <p className="mt-1 font-display text-2xl font-bold tabular-nums">{active}</p>
        </div>
      </div>

      {pending.length > 0 && (
        <Link href="/admin/jugadores" className="flex items-center gap-3 rounded-2xl border border-gold/50 bg-gold/10 px-4 py-3.5">
          <span className="flex-1 text-sm">
            <strong>{pending.length === 1 ? '1 jugador espera' : `${pending.length} jugadores esperan`}</strong> tu aprobación
          </span>
          <ChevronRight size={18} aria-hidden />
        </Link>
      )}

      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <h2 className="font-display text-lg font-semibold">Jornadas en curso</h2>
          <Link href="/admin/jornadas" className="text-sm font-semibold text-gold-bright underline-offset-4 hover:underline">
            Crear jornada
          </Link>
        </div>
        {(rounds ?? []).length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-ivory-muted">
            No hay jornadas en borrador ni abiertas.
          </p>
        ) : (
          rounds!.map((r) => {
            const fx = r.fixtures ?? []
            const todo =
              r.status === 'draft'
                ? fx.length < 2
                  ? `Faltan ${2 - fx.length} partido${fx.length === 1 ? '' : 's'}`
                  : 'Lista para publicar'
                : fx.every((f) => f.status === 'finished')
                  ? 'Lista para liquidar'
                  : fx.some((f) => new Date(f.kickoff_at).getTime() <= now && f.home_goals === null)
                    ? 'Falta meter resultados'
                    : 'Esperando a los partidos'
            return (
              <Link
                key={r.id}
                href={`/admin/jornadas/${r.id}`}
                className="flex items-center gap-3 rounded-2xl border border-line bg-carbon-2 px-4 py-3.5 hover:border-gold/50"
              >
                <span className="flex-1">
                  <span className="block font-semibold">{r.name}</span>
                  <span className="block text-sm text-ivory-muted">{todo}</span>
                </span>
                <RoundStatus status={r.status} />
                <ChevronRight size={18} aria-hidden className="text-ivory-muted" />
              </Link>
            )
          })
        )}
      </section>
    </div>
  )
}
