import Image from 'next/image'

export default function AuthLayout({ children }: LayoutProps<'/'>) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[26rem] flex-col px-5 pb-10 pt-[max(2rem,env(safe-area-inset-top))]">
      <div className="mx-auto w-44 sm:w-52">
        <Image
          src="/brand/logo-640.png"
          alt="La Porra League"
          width={640}
          height={640}
          priority
          className="h-auto w-full rounded-[22%] shadow-[0_20px_60px_-20px_rgb(200_160_75/0.45)]"
        />
      </div>
      <div className="mt-8 flex-1">{children}</div>
      <nav className="mt-10 flex justify-center gap-5 text-xs text-ivory-muted">
        <a href="/privacidad" className="hover:text-ivory">Privacidad</a>
        <a href="/condiciones" className="hover:text-ivory">Condiciones</a>
      </nav>
    </main>
  )
}
