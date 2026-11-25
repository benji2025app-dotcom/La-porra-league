import type { Metadata, Viewport } from 'next'
import '@fontsource/cinzel/600.css'
import '@fontsource/cinzel/700.css'
import '@fontsource-variable/albert-sans'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'La Porra League', template: '%s · La Porra League' },
  description: 'La porra privada de marcadores exactos del Barça y el Madrid.',
  applicationName: 'La Porra League',
  appleWebApp: { capable: true, title: 'La Porra', statusBarStyle: 'black-translucent' },
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  themeColor: '#141317',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="es" className="antialiased">
      <body>{children}</body>
    </html>
  )
}
