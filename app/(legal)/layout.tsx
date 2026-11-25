import Image from 'next/image'
import Link from 'next/link'

export default function LegalLayout({ children }: LayoutProps<'/'>) {
  return (
    <main className="mx-auto max-w-2xl px-5 pb-16 pt-[max(2rem,env(safe-area-inset-top))]">
      <Link href="/" className="inline-block">
        <Image src="/brand/wordmark-sm.png" alt="La Porra League" width={159} height={120} className="h-14 w-auto" />
      </Link>
      <article className="mt-8 space-y-4 leading-relaxed text-ivory/90 [&_h1]:font-display [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:text-ivory [&_h2]:pt-4 [&_h2]:font-display [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-ivory [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
        {children}
      </article>
    </main>
  )
}
