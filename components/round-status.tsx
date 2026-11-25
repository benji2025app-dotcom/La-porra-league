import type { Enums } from '@/lib/database.types'

const STYLES: Record<Enums<'round_status'>, { label: string; className: string }> = {
  draft: { label: 'Borrador', className: 'border-line text-ivory-muted' },
  open: { label: 'Abierta', className: 'border-ok/50 bg-ok/10 text-ok' },
  settled: { label: 'Liquidada', className: 'border-gold/50 bg-gold/10 text-gold-bright' },
  void: { label: 'Anulada', className: 'border-danger/50 bg-danger/10 text-[#f3b7ad]' },
}

export function RoundStatus({ status }: { status: Enums<'round_status'> }) {
  const s = STYLES[status]
  return <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${s.className}`}>{s.label}</span>
}
