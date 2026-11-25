import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'La Porra League',
    short_name: 'La Porra',
    description: 'La porra privada de marcadores exactos del Barça y el Madrid.',
    start_url: '/',
    display: 'standalone',
    background_color: '#141317',
    theme_color: '#141317',
    lang: 'es',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
