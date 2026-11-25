import { requireAdmin } from '@/lib/auth'
import { AdminTabs } from './admin-tabs'

export default async function AdminLayout({ children }: LayoutProps<'/admin'>) {
  await requireAdmin()
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-semibold">Administración</h1>
      <AdminTabs />
      {children}
    </div>
  )
}
