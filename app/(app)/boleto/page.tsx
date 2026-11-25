import type { Metadata } from 'next'
import { requireMember } from '@/lib/auth'

export const metadata: Metadata = { title: 'Boleto' }

// Fase 3: pantalla en construcción.
export default async function Page() {
  await requireMember()
  return (
    <section>
      <h1 className="font-display text-2xl font-semibold">Boleto</h1>
      <p className="mt-2 text-ivory-muted">Aquí rellenarás y modificarás tus dos marcadores de cada jornada. Disponible en la siguiente entrega.</p>
    </section>
  )
}
