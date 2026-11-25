'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/admin', label: 'Resumen' },
  { href: '/admin/jugadores', label: 'Jugadores' },
  { href: '/admin/jornadas', label: 'Jornadas' },
  { href: '/admin/bote', label: 'Bote' },
]

export function AdminTabs() {
  const pathname = usePathname()
  return (
    <nav aria-label="Administración" className="-mx-5 overflow-x-auto px-5">
      <ul className="flex gap-2">
        {TABS.map((t) => {
          const active = t.href === '/admin' ? pathname === '/admin' : pathname.startsWith(t.href)
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? 'page' : undefined}
                className={`block whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium ${
                  active ? 'border-gold bg-gold/15 text-gold-bright' : 'border-line text-ivory-muted hover:text-ivory'
                }`}
              >
                {t.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
