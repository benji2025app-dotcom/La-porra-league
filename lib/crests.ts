import 'server-only'
import { catalogTeam } from '@/lib/team-catalog'

// Busca el escudo de un equipo en TheSportsDB (API pública). Devuelve null si no lo encuentra.
const API = 'https://www.thesportsdb.com/api/v1/json/123/searchteams.php?t='

type ApiTeam = { strTeam?: string; strSport?: string; strGender?: string; strCountry?: string; strBadge?: string }

function variants(name: string) {
  const base = name.trim()
  const deaccent = base.normalize('NFD').replace(/[̀-ͯ]/g, '')
  const stripped = deaccent.replace(/\b(FC|CF|CD|UD|SD|RC|RCD|SAD|Club de Futbol|Club)\b\.?/gi, '').replace(/\s+/g, ' ').trim()
  const coruna = stripped.replace(/\bCoruna\b/i, 'La Coruna')
  return [...new Set([base, deaccent, stripped, coruna].filter((v) => v.length >= 3))]
}

export async function findCrest(name: string): Promise<string | null> {
  const known = catalogTeam(name)
  if (known) return known.crest
  for (const v of variants(name)) {
    try {
      const res = await fetch(API + encodeURIComponent(v), { cache: 'no-store', signal: AbortSignal.timeout(4000) })
      if (!res.ok) continue
      const json = (await res.json()) as { teams?: ApiTeam[] | null }
      const teams = (json.teams ?? []).filter((t) => t.strSport === 'Soccer' && t.strGender !== 'Female' && t.strBadge)
      const pick = teams.find((t) => t.strCountry === 'Spain') ?? teams[0]
      const badge = pick?.strBadge
      if (badge && /^https:\/\/r2\.thesportsdb\.com\//.test(badge)) return badge
    } catch {
      // Sin conexión o tiempo agotado: probamos la siguiente variante.
    }
  }
  return null
}
