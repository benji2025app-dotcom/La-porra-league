import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/auth'
import { ActionForm } from '@/components/action-form'
import { Field } from '@/components/ui'
import { createInviteCode, setInviteActive, setMemberRole, setMemberStatus } from '../actions'

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
  const { supabase, user } = await requireAdmin()
  const [{ data: members }, { data: codes }] = await Promise.all([
    supabase.rpc('admin_list_members'),
    supabase.from('invite_codes').select('*').order('created_at', { ascending: false }),
  ])
  const pending = (members ?? []).filter((m) => m.status === 'pending')
  const others = (members ?? []).filter((m) => m.status !== 'pending')

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Pendientes de aprobación</h2>
        {pending.length === 0 ? (
          <p className="text-sm text-ivory-muted">Nadie esperando.</p>
        ) : (
          pending.map((m) => (
            <article key={m.user_id} className="rounded-2xl border border-gold/40 bg-carbon-2 p-4">
              <p className="font-semibold">{m.display_name}</p>
              <p className="text-sm text-ivory-muted">{m.email}</p>
              <p className="mt-1 text-xs text-ivory-muted">
                {m.invite_code ? `Código ${m.invite_code}` : 'Aún no ha canjeado un código de invitación'}, registrado el {fmtDate(m.created_at)}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <ActionForm action={setMemberStatus} label="Aprobar" pending="Aprobando…">
                  <Hidden user_id={m.user_id} status="active" />
                </ActionForm>
                <ActionForm action={setMemberStatus} label="Rechazar" pending="…" variant="danger" confirm="Confirmar rechazo">
                  <Hidden user_id={m.user_id} status="blocked" />
                </ActionForm>
              </div>
            </article>
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Jugadores</h2>
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-carbon-2">
          {others.map((m) => (
            <li key={m.user_id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {m.display_name}
                    {m.role === 'admin' && <span className="ml-2 text-xs font-medium text-gold-bright">Admin</span>}
                    {m.status === 'blocked' && <span className="ml-2 text-xs font-medium text-danger">Desactivado</span>}
                  </p>
                  <p className="truncate text-sm text-ivory-muted">{m.email}</p>
                </div>
              </div>
              {m.user_id !== user.id && (
                <details className="mt-2 text-sm">
                  <summary className="cursor-pointer text-ivory-muted">Gestionar</summary>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {m.status === 'active' ? (
                      <ActionForm action={setMemberStatus} label="Desactivar" variant="danger" confirm="Confirmar">
                        <Hidden user_id={m.user_id} status="blocked" />
                      </ActionForm>
                    ) : (
                      <ActionForm action={setMemberStatus} label="Reactivar" variant="outline">
                        <Hidden user_id={m.user_id} status="active" />
                      </ActionForm>
                    )}
                    <ActionForm
                      action={setMemberRole}
                      label={m.role === 'admin' ? 'Quitar admin' : 'Hacer admin'}
                      variant="outline"
                      confirm="Confirmar"
                    >
                      <Hidden user_id={m.user_id} role={m.role === 'admin' ? 'player' : 'admin'} />
                    </ActionForm>
                  </div>
                </details>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Códigos de invitación</h2>
        <div className="rounded-2xl border border-line bg-carbon-2 p-4">
          <ActionForm action={createInviteCode} label="Crear código" pending="Creando…">
            <Field label="Para quién (opcional)" name="note" maxLength={80} placeholder="Grupo de amigos" />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Usos" name="max_uses" type="number" inputMode="numeric" min={1} max={100} defaultValue={10} />
              <Field label="Válido (días)" name="days" type="number" inputMode="numeric" min={1} max={90} defaultValue={7} />
            </div>
          </ActionForm>
        </div>
        <ul className="space-y-2">
          {(codes ?? []).map((c) => {
            const expired = c.expires_at !== null && new Date(c.expires_at) < new Date()
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
