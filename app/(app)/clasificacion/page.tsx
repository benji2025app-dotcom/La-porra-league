import type { Metadata } from 'next'
import { requireMember } from '@/lib/auth'
import { money } from '@/lib/format'

export const metadata: Metadata = { title: 'Clasificación' }

export default async function LeaderboardPage() {
  const { supabase, user } = await requireMember()
  const { data: rows } = await supabase.rpc('get_leaderboard')
  const anyPlayed = (rows ?? []).some((r) => r.rounds_played > 0)

  return (
    <div className="space-y-5">
      <section>
        <h1 className="font-display text-2xl font-semibold">Clasificación</h1>
        <p className="mt-1 text-sm text-ivory-muted">Ordenada por jornadas ganadas, después por lo ganado y por marcadores acertados.</p>
      </section>

      {!anyPlayed ? (
        <p className="rounded-2xl border border-dashed border-line px-5 py-8 text-center text-sm text-ivory-muted">
          La clasificación arranca cuando se cierre la primera jornada.
        </p>
      ) : (
        <table className="w-full overflow-hidden rounded-2xl border border-line bg-carbon-2 text-sm">
          <caption className="sr-only">Clasificación de la temporada</caption>
          <thead className="text-left text-xs text-ivory-muted">
            <tr className="border-b border-line">
              <th scope="col" className="py-3 pl-4 font-medium">#</th>
              <th scope="col" className="py-3 font-medium">Jugador</th>
              <th scope="col" className="py-3 text-right font-medium">Ganadas</th>
              <th scope="col" className="py-3 text-right font-medium">Aciertos</th>
              <th scope="col" className="py-3 pr-4 text-right font-medium">Ganado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows!.map((r, i) => (
              <tr key={r.user_id} className={r.user_id === user.id ? 'bg-gold/8' : ''}>
                <td className="py-3 pl-4 font-display font-bold text-gold">{i + 1}</td>
                <td className="py-3 font-medium">{r.display_name}</td>
                <td className="py-3 text-right tabular-nums">{r.wins}</td>
                <td className="py-3 text-right tabular-nums">{r.exact_hits}</td>
                <td className="py-3 pr-4 text-right tabular-nums text-gold-bright">{money(r.total_won_cents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
