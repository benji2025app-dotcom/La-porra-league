import Image from 'next/image'

type CrestTeam = { name: string; short_name?: string | null; crest_url?: string | null } | null | undefined

// Escudo del equipo; si no hay imagen, las iniciales en un círculo.
export function Crest({ team, name, size = 28, className = '' }: { team?: CrestTeam; name?: string; size?: number; className?: string }) {
  const label = team?.name ?? name ?? ''
  if (team?.crest_url) {
    return (
      <Image
        src={team.crest_url}
        alt=""
        unoptimized
        width={size}
        height={size}
        className={`shrink-0 object-contain ${className}`}
        style={{ width: size, height: size }}
      />
    )
  }
  const initials = label
    .replace(/\b(FC|CF|CD|UD|RC|SD|RCD|Real|Club|de|del)\b/gi, ' ')
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-full border border-line bg-carbon-3 font-display font-bold text-ivory-muted ${className}`}
      style={{ width: size, height: size, fontSize: Math.max(9, size * 0.36) }}
    >
      {initials || '·'}
    </span>
  )
}

// Color de acento de cada club de porra (filo de las tarjetas).
const EDGES: Record<string, string> = {
  'fc barcelona': 'linear-gradient(180deg, var(--color-barca-blue), var(--color-barca-garnet))',
  'real madrid': 'linear-gradient(180deg, var(--color-ivory), var(--color-madrid))',
  'sevilla fc': 'linear-gradient(180deg, var(--color-ivory), var(--color-sevilla))',
  'real betis': 'linear-gradient(180deg, var(--color-betis), var(--color-ivory))',
}

export function clubEdge(teamName?: string | null) {
  return EDGES[(teamName ?? '').toLowerCase()] ?? 'linear-gradient(180deg, var(--color-gold-bright), var(--color-gold-deep))'
}

export function clubLabel(team?: { name: string; short_name?: string | null } | null) {
  return `Partido del ${team?.short_name ?? team?.name ?? 'club'}`
}
