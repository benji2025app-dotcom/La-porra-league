import { requireAdmin } from '@/lib/auth'
import { AdminTabs } from './admin-tabs'

export default async function AdminLayout({ children }: LayoutProps<'/admin'>) {
  const { league } = await requireAdmin()
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Administración</h1>
        <p className="mt-1 text-sm text-ivory-muted">
          Gestionando <strong className="text-ivory">{league.name}</strong>. Cambia de porra con el selector de arriba.
        </p>
      </div>
      <AdminTabs />
      {children}
    </div>
  )
}
