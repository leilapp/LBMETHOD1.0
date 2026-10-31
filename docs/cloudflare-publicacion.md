# LB METHOD en Cloudflare · Publicación y respaldos

Guía de la etapa 8. Explica qué ya está listo en tu cuenta, los pasos que solo tú puedes hacer (porque piden tu inicio de sesión, tu pago o tu contraseña), cómo publicar cada cambio y cómo respaldar y restaurar la información.

## 1. Lo que ya está hecho en tu cuenta

| Pieza | Estado |
|---|---|
| Worker `lbmethod1-0` | Ya existía: lo creó tu conexión de Git. `cloudflare/wrangler.jsonc` usa ahora ese mismo nombre para publicar sobre él. |
| Base de datos D1 `lbmethod` | **Creada el 31/10/2026**, vacía, en la región oeste de Norteamérica (la más cercana a Guanajuato). Su id ya está en `wrangler.jsonc`. |
| Espacio de archivos R2 `lbmethod-media` | **Falta.** R2 no está activado en tu cuenta (Cloudflare responde «Please enable R2 through the Cloudflare Dashboard»). |
| Secreto `APP_SECRET` | **Falta.** Solo tú debes conocerlo; no se guarda en Git. |
| Tablas y cuenta de entrenadora | **Faltan.** Se crean con los pasos de la sección 2. |

## 2. Pasos que solo tú puedes hacer (una sola vez)

Necesitas Node 22 y el proyecto descargado en tu computadora (Windows, PowerShell).

1. **Plan de pago de Workers** (unos 5 USD al mes; confirma el precio vigente). En el plan gratuito cada petición tiene unos 10 ms de procesador, y verificar una contraseña de forma segura tarda más: el inicio de sesión fallaría. En el panel: *Workers & Pages → Plans*.
2. **Activar R2.** En el panel: *R2 Object Storage → Activar*. Cloudflare pide un medio de pago aunque los primeros 10 GB son gratis.
3. **Preparar la carpeta e iniciar sesión:**
   ```powershell
   cd cloudflare
   npm ci
   npx wrangler login
   ```
4. **Crear el espacio privado de archivos:**
   ```powershell
   npx wrangler r2 bucket create lbmethod-media
   ```
   No le actives acceso público ni dominio: los archivos solo salen por la aplicación, con permisos.
5. **Guardar el secreto.** Genera un valor aleatorio y pégalo cuando te lo pida:
   ```powershell
   node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
   npx wrangler secret put APP_SECRET
   ```
6. **Crear las tablas** (antes de migrar hace un respaldo automático en `cloudflare\respaldos\`):
   ```powershell
   npm run db:migrate:remote
   ```
7. **Crear tu cuenta de entrenadora** (la contraseña se escribe oculta y solo se guarda su huella):
   ```powershell
   npm run create-trainer -- tu-correo@dominio.com "Leilani" --remote
   ```
8. **Configurar la conexión de Git del Worker** `lbmethod1-0`. En el panel: *Workers & Pages → lbmethod1-0 → Settings → Build*:
   - Directorio raíz: `cloudflare`
   - Comando de compilación: `npm ci && npm run build`
   - Comando de publicación: `npx wrangler deploy`
   - Rama de producción: la que tenga este código. Hoy es `claude/project-thread-wllv8a`; cuando la unas a `main`, cambia a `main`.

   Si prefieres publicar a mano desde tu computadora: `npm run deploy`.
9. **Comprobar.** Abre la dirección del Worker (`https://lbmethod1-0.<tu-subdominio>.workers.dev`), entra con tu cuenta, crea un cliente de prueba y sube una foto. Si algo falla, en el panel *lbmethod1-0 → Logs* se ve el error (sin datos de las clientas).

## 3. Publicar cambios después

- Cada cambio que llegue a la rama de producción se publica solo, por la conexión de Git.
- **Si el cambio trae una migración nueva** (un archivo nuevo en `cloudflare/migrations/`), aplícala **antes** de que se publique el código: `npm run db:migrate:remote`. Ese comando respalda primero la base y los archivos, y luego migra. La conexión de Git nunca migra por su cuenta, para que no haya migraciones sin respaldo.
- Las migraciones solo agregan; nunca borran tablas ni historial (los triggers de la base lo impiden).

## 4. Respaldos

Hay dos protecciones que se complementan.

**a) Time Travel de D1 (automático).** Cloudflare guarda el historial de la base: con el plan de pago puedes volver a cualquier minuto de los últimos 30 días.
```powershell
npx wrangler d1 time-travel info lbmethod                                   # ver el punto actual
npx wrangler d1 time-travel restore lbmethod --timestamp=2026-11-15T10:00:00-06:00
```
Restaurar con Time Travel **reemplaza** la base actual por la de ese momento (se puede deshacer con otro restore al punto anterior, que el comando muestra). Úsalo solo ante un error grave y después de un respaldo con `npm run backup`. No cubre los archivos de R2.

**b) Respaldo completo propio (`npm run backup`).** Copia la base completa (con historial) y todos los archivos privados de R2 a tu computadora:
```powershell
npm run backup
```
Crea `cloudflare\respaldos\AAAA-MM-DD_HHMMSS\` con:
- `lbmethod.sql`: exportación completa de D1.
- `archivos\`: imágenes, videos y fotos de progreso.
- `manifiesto.json`: filas por tabla y huella SHA-256 de cada archivo, para comprobar una restauración.

Recomendación: hazlo cada semana y antes de cualquier cambio grande. Guarda la carpeta en un disco cifrado (BitLocker) y en un segundo lugar. Contiene datos personales de tus clientas: la carpeta `respaldos/` está excluida de Git y nunca debe subirse.

Tarda unos 3 segundos por archivo (cada archivo se descarga por separado). Con cientos de fotos puede tardar varios minutos.

## 5. Restaurar un respaldo

La restauración **nunca escribe sobre una base con datos**: solo en una base vacía. Así un error no puede borrar ni mezclar información.

**Comprobar que un respaldo sirve** (en una copia local, sin tocar Cloudflare):
```powershell
npm run restore -- respaldos\2026-11-15_100000 --local --persist-to .wrangler\prueba-restauracion
```

**Restaurar en Cloudflare:**
```powershell
npx wrangler d1 create lbmethod-restaurada          # copia el id que devuelve
npm run restore -- respaldos\2026-11-15_100000 --remote --database-id <id>
```
El comando sube la base y los archivos, y compara filas y huellas con el manifiesto. Si todo coincide, pon `database_name` y `database_id` de la base restaurada en `wrangler.jsonc` y publica. La base anterior queda intacta hasta que tú decidas qué hacer con ella.

## 6. Cómo se probó

- `npm run backup -- --local` sobre la copia local con datos reales de prueba: 31 tablas, 523 filas y 5 archivos.
- `npm run restore` en una copia local vacía: filas y huellas idénticas; un segundo intento sobre la misma copia se niega («ya tiene 31 tablas»).
- La aplicación funcionando sobre la copia restaurada: inicio de sesión, lista de clientes y una foto de progreso idéntica byte por byte.
- Respaldo de una base vacía (como la nueva de tu cuenta antes de migrar): se guarda un respaldo vacío y la migración puede seguir.
- No pude probar los pasos de la sección 2 en tu cuenta porque piden tu inicio de sesión de Wrangler, tu pago y tu contraseña.
