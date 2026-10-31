# LB METHOD · versión Cloudflare (Workers + D1 + R2)

Plan, alcance de cada etapa, pruebas y cómo ejecutarla: [docs/cloudflare-plan.md](../docs/cloudflare-plan.md). Publicar en tu cuenta, respaldar y restaurar: [docs/cloudflare-publicacion.md](../docs/cloudflare-publicacion.md).

- `src/`: Worker (Hono). Sirve las pantallas de `../frontend` compiladas en `public/` y la API en `/api`, con las mismas direcciones y respuestas que la versión .NET.
- `migrations/`: tablas de D1 (cuentas y clientes; biblioteca; rutinas y versiones; perfil y asignaciones; entrenamientos; seguimiento y calendario).
- `scripts/`: compilar las pantallas, crear la cuenta de entrenadora, respaldar (`backup.mjs`), restaurar (`restore.mjs`) y sacar la lista de endpoints de .NET para la auditoría (`endpoints-dotnet.mjs`).
- `test/`: pruebas de la API (`npm test`: cuentas y clientes, biblioteca, archivos, Excel, rutinas, clientes y asignaciones, portal y entrenamientos, seguimiento y calendario, exportaciones, auditoría de los 101 endpoints) y en navegador (`test/pantallas.cjs`).

Secretos: nunca en Git. En local van en `.dev.vars` (ver `.dev.vars.example`); en Cloudflare, con `npx wrangler secret put APP_SECRET`.
