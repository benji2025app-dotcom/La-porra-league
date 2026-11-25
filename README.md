# LA PORRA LEAGUE

Porra privada de marcadores exactos: cada jornada, un partido del FC Barcelona y otro del Real Madrid (cualquier competición oficial). Gana quien acierta **los dos** marcadores; si nadie acierta, el bote se acumula; si hay varios acertantes, se reparte.

La aplicación **no gestiona pagos**: los importes son informativos (por defecto 15 € por boleto, 12 € al bote y 3 € de gestión).

## Stack
- Next.js (App Router) + TypeScript
- Supabase (Auth, Postgres, RLS)
- Vercel (despliegue)

## Ramas
- `main` → producción. Solo se actualiza con autorización expresa.
- `develop` → desarrollo y despliegues de prueba.

## Base de datos
Migraciones en `supabase/migrations`, tests de reglas en `supabase/tests`.

### Tests
`supabase/tests/porra_rules_test.sql` ejecuta 50+ comprobaciones (registro, visibilidad, bloqueo, liquidación, bote, anulación, clasificación y permisos). Se ejecuta en una base sin usuarios y lo deshace todo al terminar: el resultado correcto es el error `ALL_TESTS_PASSED`.
