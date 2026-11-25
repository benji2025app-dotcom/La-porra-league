import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Condiciones del servicio', robots: { index: true, follow: true } }

export default function TermsPage() {
  return (
    <>
      <h1>Condiciones del servicio</h1>
      <p className="text-sm text-ivory-muted">Última actualización: 26 de noviembre de 2026</p>
      <h2>Qué es</h2>
      <p>
        La Porra League es una aplicación privada de pronósticos para un grupo de amigos. Solo se accede con un código de invitación y la
        aprobación del administrador.
      </p>
      <h2>Reglas de juego</h2>
      <ul>
        <li>Cada jornada se pronostican dos partidos: uno del FC Barcelona y otro del Real Madrid, de cualquier competición oficial.</li>
        <li>Para ganar hay que acertar los dos marcadores exactos. Si nadie acierta, el bote se acumula; si hay varios acertantes, se reparte.</li>
        <li>Los pronósticos se bloquean al empezar cada partido y los del resto del grupo se muestran a partir de ese momento.</li>
      </ul>
      <h2>Sin pagos</h2>
      <p>
        La aplicación no cobra ni gestiona dinero. Las cantidades del bote son informativas y cualquier acuerdo económico es responsabilidad
        del grupo, fuera de la aplicación.
      </p>
      <h2>Uso correcto</h2>
      <p>
        Cada persona usa una sola cuenta y no intenta manipular la aplicación. El administrador puede desactivar cuentas que incumplan estas
        normas.
      </p>
      <h2>Contacto</h2>
      <p>benji2025app@gmail.com</p>
    </>
  )
}
