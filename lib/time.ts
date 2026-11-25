// Conversión entre la hora de Madrid (lo que escribe el admin) y UTC (lo que guarda la base de datos).
const TZ = 'Europe/Madrid'

function offsetMinutes(utcMs: number) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(utcMs))
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return (asUtc - utcMs) / 60000
}

/** "2026-12-06T21:00" (hora de Madrid) → ISO UTC */
export function madridLocalToIso(value: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value)
  if (!m) return null
  const naive = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5])
  let utc = naive - offsetMinutes(naive) * 60000
  utc = naive - offsetMinutes(utc) * 60000 // segunda pasada para los cambios de hora
  return new Date(utc).toISOString()
}

/** ISO UTC → "2026-12-06T21:00" en hora de Madrid (para inputs datetime-local) */
export function isoToMadridLocal(iso: string): string {
  const ms = new Date(iso).getTime()
  const local = new Date(ms + offsetMinutes(ms) * 60000)
  return local.toISOString().slice(0, 16)
}

/** Hora actual del servidor en el momento de renderizar (las peticiones son dinámicas). */
export function serverNow() {
  return Date.now()
}
