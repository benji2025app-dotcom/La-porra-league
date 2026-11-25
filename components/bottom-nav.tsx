'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarDays, Home, Ticket, Trophy, UserRound } from 'lucide-react'

const ITEMS = [
  { href: '/', label: 'Inicio', icon: Home },
  { href: '/boleto', label: 'Boleto', icon: Ticket },
  { href: '/calendario', label: 'Calendario', icon: CalendarDays },
  { href: '/clasificacion', label: 'Clasificación', icon: Trophy },
  { href: '/perfil', label: 'Perfil', icon: UserRound },
] as const

export function BottomNav() {
  const pathname = usePathname()
  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line/80 bg-carbon/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl"
    >
      <ul className="mx-auto grid max-w-xl grid-cols-5">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`relative flex flex-col items-center gap-1 pb-2.5 pt-3 text-[0.68rem] font-medium transition-colors ${
                  active ? 'text-gold-bright' : 'text-ivory-muted hover:text-ivory'
                }`}
              >
                {active && <span aria-hidden className="absolute inset-x-5 top-0 h-[2px] rounded-b bg-gold-bright" />}
                <Icon size={21} strokeWidth={active ? 2.2 : 1.7} aria-hidden />
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
