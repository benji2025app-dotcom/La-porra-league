import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/auth'

export const metadata: Metadata = { title: 'Administración' }

// Fase 4: panel de administración.
export default async function AdminPage() {
  await requireAdmin()
  return (
    <section>
      <h1 className="font-display text-2xl font-semibold">Administración</h1>
      <p className="mt-2 text-ivory-muted">Aprobación de jugadores, jornadas, resultados y bote. Disponible en la siguiente entrega.</p>
    </section>
  )
}
