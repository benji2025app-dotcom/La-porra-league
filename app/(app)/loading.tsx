// Esqueleto mientras carga cada pantalla (evita pantallas en blanco en móvil con mala cobertura).
export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Cargando">
      <div className="h-8 w-40 animate-pulse rounded-lg bg-carbon-3" />
      <div className="h-32 animate-pulse rounded-[18px] bg-carbon-2" />
      <div className="h-20 animate-pulse rounded-2xl bg-carbon-2" />
      <div className="h-20 animate-pulse rounded-2xl bg-carbon-2" />
    </div>
  )
}
