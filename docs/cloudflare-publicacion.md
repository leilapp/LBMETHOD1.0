# LB METHOD en Cloudflare · Publicación y respaldos

Guía de la etapa 8, actualizada el 31/10/2026 para el **plan gratuito**: no necesitas pagar ni registrar una tarjeta. Explica qué ya está listo en tu cuenta, cómo abrir la app desde el link gratuito de Cloudflare, cómo publicar cada cambio y cómo respaldar y restaurar la información.

## 1. Lo que ya está hecho en tu cuenta (todo gratis)

| Pieza | Estado |
|---|---|
| Worker `lbmethod1-0` | Ya existía: lo creó tu conexión de Git. `cloudflare/wrangler.jsonc` usa ese mismo nombre para publicar sobre él. |
| Base de datos D1 `lbmethod` | **Creada y lista**, en la región oeste de Norteamérica (la más cercana a Guanajuato). Tiene las 7 migraciones aplicadas (32 tablas, 25 índices, 37 protecciones del historial y los catálogos iniciales). Plan gratis: hasta 500 MB. |
| Tu cuenta de entrenadora | **Creada** con tu correo y una contraseña temporal. Al entrar por primera vez, la app te pide crear la tuya. |
| Espacio de archivos KV `lbmethod-archivos` | **Creado.** Guarda imágenes, videos y fotos de progreso, privados (sin dirección pública). Reemplaza a R2, que pedía tarjeta. |
| Llave de seguridad (`APP_SECRET`) | **No hace falta configurarla.** El Worker genera una al azar y la guarda en la base. |

## 2. Abrir la app

1. Cada cambio que llega a la rama `claude/project-thread-wllv8a` se publica solo en tu Worker (unos 2 minutos).
2. Abre **https://lbmethod1-0.le1.workers.dev/** (también está en el panel: *Workers & Pages → lbmethod1-0 → Visit*).
3. Entra con tu correo y la contraseña temporal, y crea la tuya.
4. **App de Android (APK):** en un teléfono Android, debajo del inicio de sesión aparece «Descargar app para Android (APK)». Baja `LB-METHOD.apk`; al abrirlo, Android pide permitir instalar apps de Chrome (es normal: no viene de la Play Store). Detalles en [android/LEEME.md](../android/LEEME.md).
5. **Instalar sin APK:** en Chrome (Android o computadora) también puede aparecer el botón «Instalar la app en este dispositivo». También puedes usar el menú ⋮ → «Instalar app» o «Agregar a pantalla de inicio». En iPhone: Compartir → «Agregar a inicio». Queda con su ícono, como una app más, sin tienda.

**Si el link no abre o muestra un error de Cloudflare**, revisa la conexión de Git: *Workers & Pages → lbmethod1-0 → Settings → Build*:
- Directorio raíz: `cloudflare`
- Comando de compilación: `npm ci && npm run build`
- Comando de publicación: `npx wrangler deploy`
- Rama: `claude/project-thread-wllv8a` (cuando la unas a `main`, cambia a `main`).

En *lbmethod1-0 → Deployments* se ve si la última publicación falló, y en *Logs* el error (sin datos de las clientas).

### Límites del plan gratuito que conviene conocer

| Límite | Qué significa para LB METHOD |
|---|---|
| 100 000 peticiones al día | Sobra para un estudio: cada pantalla usa unas cuantas. |
| ~10 ms de procesador por petición | Por eso las contraseñas se guardan con 10 000 iteraciones de PBKDF2 en lugar de 100 000 (ver abajo). Si una exportación o importación de Excel muy grande fallara con «error 1102», divídela en partes. |
| Archivos: 1 GB en total y 1 000 subidas al día | Imágenes hasta 5 MB, fotos de progreso hasta 10 MB y videos hasta **25 MB** (antes 90 MB). Para videos largos usa un enlace (por ejemplo, YouTube no listado), que la biblioteca ya acepta. Un video se guarda en partes de 4 MB: cada parte cuenta como una subida. |
| Base de datos: 500 MB | Para datos de texto (clientas, rutinas, registros) alcanza para muchos años. |
| Time Travel: 7 días | Puedes volver la base a cualquier momento de la última semana (con plan de pago serían 30). |

**Sobre las contraseñas:** con 10 000 iteraciones el inicio de sesión tarda unos 5 ms y cabe en el plan gratis. La defensa principal contra quien intente adivinar contraseñas sigue igual: 10 intentos por minuto y bloqueo de 15 minutos tras 5 fallos. La diferencia solo importaría si alguien robara la base completa: descifrar cada contraseña le costaría 10 veces menos. Si algún día pasas al plan de pago, se puede volver a subir el número y las cuentas se actualizan solas al entrar.

**Si algún día quieres R2** (más espacio para videos): actívalo en el panel, crea el bucket privado `lbmethod-media` y agrega en `wrangler.jsonc` `"r2_buckets": [{ "binding": "MEDIA", "bucket_name": "lbmethod-media" }]`. El código ya sabe usarlo. Los archivos ya guardados en KV tendrían que copiarse (respaldo y restauración).

## 3. Publicar cambios después

- Cada cambio que llegue a la rama de producción se publica solo, por la conexión de Git.
- **Si el cambio trae una migración nueva** (un archivo nuevo en `cloudflare/migrations/`), aplícala **antes** de que se publique el código: `npm run db:migrate:remote`. Ese comando respalda primero la base y los archivos, y luego migra. La conexión de Git nunca migra por su cuenta, para que no haya migraciones sin respaldo.
- Las migraciones solo agregan; nunca borran tablas ni historial (los triggers de la base lo impiden).

## 4. Respaldos

Hay dos protecciones que se complementan.

**a) Time Travel de D1 (automático).** Cloudflare guarda el historial de la base: en el plan gratuito puedes volver a cualquier minuto de los últimos 7 días.
```powershell
npx wrangler d1 time-travel info lbmethod                                   # ver el punto actual
npx wrangler d1 time-travel restore lbmethod --timestamp=2026-11-15T10:00:00-06:00
```
Restaurar con Time Travel **reemplaza** la base actual por la de ese momento (se puede deshacer con otro restore al punto anterior, que el comando muestra). Úsalo solo ante un error grave y después de un respaldo con `npm run backup`. No cubre los archivos (imágenes, videos y fotos).

**b) Respaldo completo propio (`npm run backup`).** Copia la base completa (con historial) y todos los archivos privados del espacio KV a tu computadora:
```powershell
npm run backup
```
Crea `cloudflare\respaldos\AAAA-MM-DD_HHMMSS\` con:
- `lbmethod.sql`: exportación completa de D1.
- `archivos\`: imágenes, videos y fotos de progreso.
- `manifiesto.json`: filas por tabla y huella SHA-256 de cada archivo, para comprobar una restauración.

Recomendación: hazlo cada semana y antes de cualquier cambio grande. Guarda la carpeta en un disco cifrado (BitLocker) y en un segundo lugar. Contiene datos personales de tus clientas: la carpeta `respaldos/` está excluida de Git y nunca debe subirse.

Tarda unos 3 segundos por parte de 4 MB (cada parte se descarga por separado). Con cientos de fotos puede tardar varios minutos. Leer archivos cuenta para el límite gratis de 100 000 lecturas al día, que sobra.

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
Los archivos se suben al espacio KV de `wrangler.jsonc` (o a otro con `--kv-id <id>`; se crea con `npx wrangler kv namespace create lbmethod-archivos-restaurados`). Ten en cuenta el límite gratis de 1 000 escrituras al día: cada parte de 4 MB es una escritura.
El comando sube la base y los archivos, y compara filas y huellas con el manifiesto. Si todo coincide, pon `database_name` y `database_id` de la base restaurada en `wrangler.jsonc` y publica. La base anterior queda intacta hasta que tú decidas qué hacer con ella.

## 6. Cómo se probó

- `npm run backup -- --local` sobre la copia local con datos reales de prueba: 31 tablas, 523 filas y 5 archivos.
- `npm run restore` en una copia local vacía: filas y huellas idénticas; un segundo intento sobre la misma copia se niega («ya tiene 31 tablas»).
- La aplicación funcionando sobre la copia restaurada: inicio de sesión, lista de clientes y una foto de progreso idéntica byte por byte.
- Respaldo de una base vacía (como la nueva de tu cuenta antes de migrar): se guarda un respaldo vacío y la migración puede seguir.
- Archivos en KV (plan gratuito): un video de 9 MB (3 partes) se sube, se descarga idéntico byte por byte y se entrega por trozos, incluido un trozo que cruza dos partes; uno de más de 25 MB se rechaza con un mensaje claro.
- Inicio de sesión con 10 000 iteraciones, y una cuenta guardada con 100 000 que se actualiza sola al entrar sin cambiar su contraseña.
- No puedo abrir tu link de workers.dev desde mi entorno (la red lo bloquea), así que la prueba final en tu cuenta es abrirlo tú.
