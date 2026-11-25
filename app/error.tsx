'use client'

import Link from 'next/link'

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[26rem] flex-col items-center justify-center px-5 text-center">
      <h1 className="font-display text-2xl font-semibold">Algo ha fallado</h1>
      <p className="mt-2 text-ivory-muted">No se ha podido cargar esta pantalla. Tus pronósticos guardados no se han perdido.</p>
      <button type="button" onClick={reset} className="btn-gold mt-8 w-full rounded-xl px-5 py-3.5 text-sm font-semibold">
        Reintentar
      </button>
      <Link href="/" className="mt-4 text-sm text-ivory-muted underline-offset-4 hover:underline">
        Volver al inicio
      </Link>
    </main>
  )
}
