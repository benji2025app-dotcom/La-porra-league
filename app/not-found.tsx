import Image from 'next/image'
import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[26rem] flex-col items-center justify-center px-5 text-center">
      <Image src="/brand/logo-640.png" alt="" width={640} height={640} className="h-auto w-28 rounded-[22%] opacity-80" />
      <h1 className="mt-8 font-display text-2xl font-semibold">Fuera de juego</h1>
      <p className="mt-2 text-ivory-muted">Esta página no existe o ya no está disponible.</p>
      <Link href="/" className="btn-gold mt-8 w-full rounded-xl px-5 py-3.5 text-sm font-semibold">
        Volver al inicio
      </Link>
    </main>
  )
}
