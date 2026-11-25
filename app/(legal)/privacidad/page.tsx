import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Política de privacidad', robots: { index: true, follow: true } }

export default function PrivacyPage() {
  return (
    <>
      <h1>Política de privacidad</h1>
      <p className="text-sm text-ivory-muted">Última actualización: 26 de noviembre de 2026</p>
      <p>
        La Porra League es una aplicación privada para un grupo cerrado de amigos que juegan una porra de marcadores exactos. Esta política
        explica qué datos tratamos y para qué.
      </p>
      <h2>Responsable</h2>
      <p>El administrador de La Porra League. Contacto: benji2025app@gmail.com.</p>
      <h2>Datos que tratamos</h2>
      <ul>
        <li>Correo electrónico y nombre para mostrar, para crear tu cuenta e identificarte en la porra.</li>
        <li>Si entras con Google, recibimos de Google tu nombre y tu correo. No accedemos a ningún otro dato de tu cuenta de Google.</li>
        <li>Tus pronósticos, el código de invitación que usaste y el historial de cambios de tus pronósticos.</li>
      </ul>
      <h2>Para qué los usamos</h2>
      <p>
        Solo para el funcionamiento de la porra: gestionar tu acceso, guardar tus pronósticos, mostrarlos al resto del grupo cuando empieza cada
        partido, calcular ganadores y la clasificación. No enviamos publicidad ni vendemos ni cedemos datos a terceros.
      </p>
      <h2>Dónde se guardan</h2>
      <p>
        En Supabase (base de datos y autenticación, servidores en la Unión Europea) y la aplicación se sirve desde Vercel. Estos proveedores
        actúan como encargados del tratamiento.
      </p>
      <h2>Pagos</h2>
      <p>La aplicación no gestiona pagos ni guarda datos bancarios. Los importes que aparecen son solo informativos.</p>
      <h2>Conservación y tus derechos</h2>
      <p>
        Conservamos tus datos mientras participes en la porra. Puedes pedir acceder a ellos, corregirlos o borrar tu cuenta escribiendo a
        benji2025app@gmail.com.
      </p>
    </>
  )
}
