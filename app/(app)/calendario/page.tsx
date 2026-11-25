import type { Metadata } from 'next'
import { requireMember } from '@/lib/auth'

export const metadata: Metadata = { title: 'Calendario' }

// Fase 3: pantalla en construcción.
export default async function Page() {
  await requireMember()
  return (
    <section>
      <h1 className="font-display text-2xl font-semibold">Calendario</h1>
      <p className="mt-2 text-ivory-muted">Aquí verás todas las jornadas, sus partidos y los resultados. Disponible en la siguiente entrega.</p>
    </section>
  )
}
