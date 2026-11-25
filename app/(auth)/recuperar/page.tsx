import type { Metadata } from 'next'
import { RecoverForm } from './recover-form'

export const metadata: Metadata = { title: 'Recuperar contraseña' }

export default async function RecoverPage({ searchParams }: PageProps<'/recuperar'>) {
  const { aviso } = await searchParams
  return <RecoverForm expired={aviso === 'enlace'} />
}
