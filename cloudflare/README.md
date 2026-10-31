# LB METHOD · versión Cloudflare (Workers + D1 + R2)

En construcción por etapas. Plan, alcance de cada etapa, pruebas y cómo ejecutarla: [docs/cloudflare-plan.md](../docs/cloudflare-plan.md).

- `src/`: Worker (Hono). Sirve las pantallas de `../frontend` compiladas en `public/` y la API en `/api`, con las mismas direcciones y respuestas que la versión .NET.
- `migrations/`: tablas de D1 (cuentas y clientes; biblioteca de ejercicios; rutinas y versiones).
- `scripts/`: compilar las pantallas y crear la cuenta de entrenadora.
- `test/`: pruebas de la API (`npm test`: cuentas y clientes, biblioteca, archivos, Excel y rutinas) y en navegador (`test/pantallas.cjs`).

Secretos: nunca en Git. En local van en `.dev.vars` (ver `.dev.vars.example`); en Cloudflare, con `npx wrangler secret put APP_SECRET`.
