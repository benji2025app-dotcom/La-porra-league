import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/auth'
import { ActionForm } from '@/components/action-form'
import { Field } from '@/components/ui'
import { Crest } from '@/components/crest'
import { createLeague, findMissingCrests, updateLeague, updateTeam } from '../actions'

export const metadata: Metadata = { title: 'Porras y equipos' }

export default async function LeaguesPage() {
  const { supabase, leagues } = await requireAdmin()
  const [{ data: teams }, { data: members }] = await Promise.all([
    supabase.from('teams').select('id, name, short_name, crest_url').order('name'),
    supabase.rpc('admin_list_members', {}),
  ])
  const count = (leagueId: string) => (members ?? []).filter((m) => m.league_id === leagueId && m.member_status === 'active').length
  const missing = (teams ?? []).filter((t) => !t.crest_url).length

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Porras</h2>
        <ul className="space-y-2">
          {leagues.map((l) => (
            <li key={l.id} className="rounded-2xl border border-line bg-carbon-2 p-4">
              <div className="flex items-center gap-3">
                <span className="flex -space-x-1.5">
                  <Crest team={l.club_a} size={28} />
                  <Crest team={l.club_b} size={28} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">
                    {l.name}
                    {!l.is_active && <span className="ml-2 text-xs font-medium text-danger">Desactivada</span>}
                  </span>
                  <span className="block text-xs text-ivory-muted">
                    {l.club_a.short_name ?? l.club_a.name} y {l.club_b.short_name ?? l.club_b.name}, {count(l.id)} jugadores
                  </span>
                </span>
              </div>
              <details className="mt-2 text-sm">
                <summary className="cursor-pointer text-ivory-muted">Editar</summary>
                <ActionForm action={updateLeague} label="Guardar porra" className="mt-3">
                  <input type="hidden" name="league_id" value={l.id} />
                  <Field label="Nombre" name="name" defaultValue={l.name} maxLength={40} required />
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="is_active" defaultChecked={l.is_active} className="size-4 accent-[#c8a04b]" />
                    Activa (los jugadores la ven)
                  </label>
                </ActionForm>
              </details>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-line bg-carbon-2 p-4">
        <h2 className="font-display text-lg font-semibold">Nueva porra</h2>
        <p className="mb-3 mt-1 text-xs text-ivory-muted">
          Cada jornada tendrá un partido de cada uno de los dos clubes. El precio del boleto es el mismo que en las demás.
        </p>
        <ActionForm action={createLeague} label="Crear porra" pending="Creando…">
          <Field label="Nombre" name="name" maxLength={40} placeholder="Trabajo" required />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Club 1" name="club_a" list="equipos" placeholder="Sevilla FC" required />
            <Field label="Club 2" name="club_b" list="equipos" placeholder="Real Betis" required />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="join" defaultChecked className="size-4 accent-[#c8a04b]" />
            Yo también juego en esta porra
          </label>
        </ActionForm>
        <datalist id="equipos">
          {(teams ?? []).map((t) => (
            <option key={t.id} value={t.name} />
          ))}
        </datalist>
      </section>

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <h2 className="font-display text-lg font-semibold">Equipos y escudos</h2>
          <span className="text-xs text-ivory-muted">{missing ? `${missing} sin escudo` : 'Todos con escudo'}</span>
        </div>
        <p className="text-xs text-ivory-muted">
          Los equipos se crean solos al añadir partidos. Si un escudo no aparece, búscalo o pega el enlace de la imagen (https).
        </p>
        {missing > 0 && <ActionForm action={findMissingCrests} label="Buscar escudos que faltan" pending="Buscando…" variant="outline" />}
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-carbon-2">
          {(teams ?? []).map((t) => (
            <li key={t.id} className="p-4">
              <details>
                <summary className="flex cursor-pointer items-center gap-3">
                  <Crest team={t} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{t.name}</span>
                    <span className="block text-xs text-ivory-muted">{t.crest_url ? (t.short_name ?? 'Escudo listo') : 'Sin escudo'}</span>
                  </span>
                </summary>
                <ActionForm action={updateTeam} label="Guardar equipo" className="mt-3">
                  <input type="hidden" name="team_id" value={t.id} />
                  <div className="grid grid-cols-[1fr_7rem] gap-3">
                    <Field label="Nombre" name="name" defaultValue={t.name} maxLength={60} required />
                    <Field label="Corto" name="short_name" defaultValue={t.short_name ?? ''} maxLength={14} />
                  </div>
                  <Field label="Enlace del escudo" name="crest_url" type="url" defaultValue={t.crest_url ?? ''} placeholder="https://…" />
                </ActionForm>
              </details>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
