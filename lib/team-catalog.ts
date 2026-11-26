// Catálogo de equipos con su escudo: no depende de ninguna búsqueda externa.
const B = 'https://r2.thesportsdb.com/images/media/team/badge/'

export type CatalogTeam = { name: string; short: string; crest: string; aliases: string[] }

export const TEAM_CATALOG: CatalogTeam[] = [
  { name: 'FC Barcelona', short: 'Barça', crest: B + 'wq9sir1639406443.png', aliases: ['barcelona', 'barca'] },
  { name: 'Real Madrid', short: 'Madrid', crest: B + 'vwvwrw1473502969.png', aliases: ['madrid', 'real madrid cf'] },
  { name: 'Sevilla FC', short: 'Sevilla', crest: B + 'vpsqqx1473502977.png', aliases: ['sevilla'] },
  { name: 'Real Betis', short: 'Betis', crest: B + '2oqulv1663245386.png', aliases: ['betis', 'real betis balompie'] },
  { name: 'Athletic Club', short: 'Athletic', crest: B + '68w7fe1639408210.png', aliases: ['athletic', 'athletic bilbao', 'athletic de bilbao', 'bilbao'] },
  { name: 'Atlético de Madrid', short: 'Atlético', crest: B + '0ulh3q1719984315.png', aliases: ['atletico madrid', 'atletico', 'atleti', 'at madrid', 'atl madrid'] },
  { name: 'Celta de Vigo', short: 'Celta', crest: B + 'xfjtku1690436219.png', aliases: ['celta', 'celta vigo', 'rc celta'] },
  { name: 'Alavés', short: 'Alavés', crest: B + 'mfn99h1734673842.png', aliases: ['deportivo alaves', 'alaves'] },
  {
    name: 'Deportivo de La Coruña',
    short: 'Depor',
    crest: B + '62bvwv1783013156.png',
    aliases: ['deportivo', 'depor', 'deportivo coruna', 'deportivo la coruna', 'deportivo a coruna', 'deportivo de a coruna', 'rc deportivo'],
  },
  { name: 'Elche CF', short: 'Elche', crest: B + 'e4vaw51655594332.png', aliases: ['elche'] },
  { name: 'RCD Espanyol', short: 'Espanyol', crest: B + '867nzz1681703222.png', aliases: ['espanyol', 'espanol'] },
  { name: 'Getafe CF', short: 'Getafe', crest: B + 'eyh2891655594452.png', aliases: ['getafe'] },
  { name: 'Levante UD', short: 'Levante', crest: B + 'xwtxsx1473503739.png', aliases: ['levante'] },
  { name: 'RCD Mallorca', short: 'Mallorca', crest: B + 'ssptsx1473503730.png', aliases: ['mallorca', 'real mallorca'] },
  { name: 'CA Osasuna', short: 'Osasuna', crest: B + 'rvspvt1473502960.png', aliases: ['osasuna'] },
  { name: 'Rayo Vallecano', short: 'Rayo', crest: B + 'nzhu941655595465.png', aliases: ['rayo'] },
  { name: 'Real Oviedo', short: 'Oviedo', crest: B + 'yuwqus1447590681.png', aliases: ['oviedo'] },
  { name: 'Real Sociedad', short: 'Real Sociedad', crest: B + 'vptvpr1473502986.png', aliases: ['la real', 'sociedad'] },
  { name: 'Valencia CF', short: 'Valencia', crest: B + 'dm8l6o1655594864.png', aliases: ['valencia'] },
  { name: 'Villarreal CF', short: 'Villarreal', crest: B + 'vrypqy1473503073.png', aliases: ['villarreal', 'villareal'] },
  { name: 'Girona FC', short: 'Girona', crest: B + 'kfu7zu1659897499.png', aliases: ['girona'] },
]

// Normaliza un nombre: sin tildes, minúsculas, sin siglas de club.
export function normTeam(name: string) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[.\-']/g, ' ')
    .replace(/\b(fc|cf|rcd|ca|ud|sd|cd|sad|club de futbol)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const INDEX = new Map<string, CatalogTeam>()
for (const t of TEAM_CATALOG) for (const k of [t.name, t.short, ...t.aliases]) INDEX.set(normTeam(k), t)

export function catalogTeam(name: string) {
  return INDEX.get(normTeam(name)) ?? null
}
