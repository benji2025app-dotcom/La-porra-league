import type { Metadata } from 'next'
import { LoginForm } from './login-form'

export const metadata: Metadata = { title: 'Entrar' }

const AVISOS: Record<string, string> = {
  confirmado: 'Tu correo está confirmado. Entra con tu contraseña.',
  google: 'No se ha podido entrar con Google. Inténtalo de nuevo o usa tu correo.',
  enlace: 'Ese enlace no es válido o ha caducado. Entra con tu contraseña o pide uno nuevo.',
}

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const { aviso } = await searchParams
  const notice = typeof aviso === 'string' ? AVISOS[aviso] : undefined
  return <LoginForm notice={notice} />
}
