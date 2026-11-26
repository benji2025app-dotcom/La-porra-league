import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/auth'
import { serverNow } from '@/lib/time'
import { ActionForm } from '@/components/action-form'
import { Field } from '@/components/ui'
import { createInviteCode, setAccountStatus, setInviteActive, setMemberRole, setMembership } from '../actions'

export const metadata: Metadata = { title: 'Jugadores' }

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', timeZone: 'Europe/Madrid' }).format(new Date(iso))

function Hidden(props: Record<string, string>) {
  return (
    <>
      {Object.entries(props).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
    </>
  )
}

export default async function PlayersPage() {
  const { supabase, user, league } = await requireAdmin()
  const [{ data: all }, { data: codes }] = await Promise.all([
    supabase.rpc('admin_list_members', {}),
    supabase.from('invite_codes').select('*').eq('league_id', league.id).order('created_at', { ascending: false }),
  ])
  const here = (all ?? []).filter((m) => m.league_id === league.id)
  const pending = here.filter((m) => m.member_status === 'pending')
  const members = here.filter((m) => m.member_status !== 'pending').sort((a, b) => a.display_name.localeCompare(b.display_name, 'es'))
  const hereIds = new Set(here.map((m) => m.user_id))
  const outsiders = [...new Map((all ?? []).filter((m) => !hereIds.has(m.user_id)).map((m) => [m.user_id, m])).values()]
  const leaguesOf = (userId: string) =>
    (all ?? [])
      .filter((m) => m.user_id === userId && m.member_status === 'active')
      .map((m) => m.league_name)
      .join(', ')
  const now = serverNow()

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Pendientes en {league.name}</h2>
        {pending.length === 0 ? (
          <p className="text-sm text-ivory-muted">Nadie esperando.</p>
        ) : (
          pending.map((m) => (
            <article key={m.user_id} className="rounded-2xl border border-gold/40 bg-carbon-2 p-4">
              <p className="font-semibold">{m.display_name}</p>
              <p className="text-sm text-ivory-muted">{m.email}</p>
              <p className="mt-1 text-xs text-ivory-muted">
                {m.invite_code ? `Código ${m.invite_code}` : 'Sin código'}, pidió entrar el {fmtDate(m.joined_at)}
                {leaguesOf(m.user_id) ? `. Ya juega en ${leaguesOf(m.user_id)}` : ''}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <ActionForm action={setMembership} label="Aprobar" pending="Aprobando…">
                  <Hidden league_id={league.id} user_id={m.user_id} status="active" />
                </ActionForm>
                <ActionForm action={setMembership} label="Rechazar" pending="…" variant="danger" confirm="Confirmar rechazo">
                  <Hidden league_id={league.id} user_id={m.user_id} status="blocked" />
                </ActionForm>
              </div>
            </article>
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Jugadores de {league.name}</h2>
        {members.length === 0 && <p className="text-sm text-ivory-muted">Aún no hay nadie. Crea un código de invitación abajo.</p>}
        {members.length > 0 && (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-carbon-2">
            {members.map((m) => (
              <li key={m.user_id} className="p-4">
                <p className="font-semibold">
                  {m.display_name}
                  {m.role === 'admin' && <span className="ml-2 text-xs font-medium text-gold-bright">Admin</span>}
                  {m.member_status === 'blocked' && <span className="ml-2 text-xs font-medium text-danger">Fuera de la porra</span>}
                  {m.account_status === 'blocked' && <span className="ml-2 text-xs font-medium text-danger">Cuenta desactivada</span>}
                </p>
                <p className="truncate text-sm text-ivory-muted">{m.email}</p>
                {m.user_id !== user.id && (
                  <details className="mt-2 text-sm">
                    <summary className="cursor-pointer text-ivory-muted">Gestionar</summary>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {m.member_status === 'active' ? (
                        <ActionForm action={setMembership} label={`Sacar de ${league.name}`} variant="danger" confirm="Confirmar">
                          <Hidden league_id={league.id} user_id={m.user_id} status="blocked" />
                        </ActionForm>
                      ) : (
                        <ActionForm action={setMembership} label="Volver a meter" variant="outline">
                          <Hidden league_id={league.id} user_id={m.user_id} status="active" />
                        </ActionForm>
                      )}
                      {m.account_status === 'active' ? (
                        <ActionForm action={setAccountStatus} label="Desactivar cuenta" variant="danger" confirm="Fuera de todas las porras">
                          <Hidden user_id={m.user_id} status="blocked" />
                        </ActionForm>
                      ) : (
                        <ActionForm action={setAccountStatus} label="Reactivar cuenta" variant="outline">
                          <Hidden user_id={m.user_id} status="active" />
                        </ActionForm>
                      )}
                      <ActionForm
                        action={setMemberRole}
                        label={m.role === 'admin' ? 'Quitar admin' : 'Hacer admin'}
                        variant="outline"
                        confirm="Ve todas las porras"
                        className="col-span-2"
                      >
                        <Hidden user_id={m.user_id} role={m.role === 'admin' ? 'player' : 'admin'} />
                      </ActionForm>
                    </div>
                  </details>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {outsiders.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold">Añadir de otras porras</h2>
          <p className="text-xs text-ivory-muted">Jugadores que ya tienen cuenta. Los metes en {league.name} sin que necesiten código.</p>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-carbon-2">
            {outsiders.map((m) => (
              <li key={m.user_id} className="flex items-center justify-between gap-3 p-4">
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{m.display_name}</span>
                  <span className="block truncate text-xs text-ivory-muted">{leaguesOf(m.user_id) || 'Sin porra activa'}</span>
                </span>
                <ActionForm action={setMembership} label="Añadir" variant="outline">
                  <Hidden league_id={league.id} user_id={m.user_id} status="active" />
                </ActionForm>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Códigos de {league.name}</h2>
        <p className="text-xs text-ivory-muted">Quien use un código de esta porra entra solo en {league.name}, y queda pendiente hasta que lo apruebes.</p>
        <div className="rounded-2xl border border-line bg-carbon-2 p-4">
          <ActionForm action={createInviteCode} label="Crear código" pending="Creando…">
            <Hidden league_id={league.id} />
            <Field label="Para quién (opcional)" name="note" maxLength={80} placeholder={`Grupo ${league.name}`} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Usos" name="max_uses" type="number" inputMode="numeric" min={1} max={200} defaultValue={50} />
              <Field label="Válido (días)" name="days" type="number" inputMode="numeric" min={1} max={90} defaultValue={14} />
            </div>
          </ActionForm>
        </div>
        <ul className="space-y-2">
          {(codes ?? []).map((c) => {
            const expired = c.expires_at !== null && new Date(c.expires_at).getTime() < now
            const usable = c.is_active && !expired && (c.max_uses === null || c.used_count < c.max_uses)
            return (
              <li key={c.code} className="rounded-2xl border border-line bg-carbon-2 p-4">
                <p className={`select-all font-mono text-base tracking-wider ${usable ? 'text-gold-bright' : 'text-ivory-muted line-through'}`}>
                  {c.code}
                </p>
                <p className="mt-1 text-xs text-ivory-muted">
                  {c.note ? `${c.note}. ` : ''}
                  {c.used_count}/{c.max_uses ?? '∞'} usos
                  {c.expires_at ? `, caduca el ${fmtDate(c.expires_at)}` : ''}
                  {!c.is_active ? ', desactivado' : expired ? ', caducado' : ''}
                </p>
                {!expired && (
                  <ActionForm action={setInviteActive} label={c.is_active ? 'Desactivar' : 'Activar'} variant="outline" className="mt-3">
                    <Hidden code={c.code} active={String(!c.is_active)} />
                  </ActionForm>
                )}
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
