# LB METHOD · Guía de despliegue y variables de entorno

> **Decisión pendiente (D6):** todavía no está elegido el hospedaje. Esta guía sirve para cualquiera de las tres opciones de la Fase 1 (servidor Windows con IIS, Azure App Service + Azure SQL, o un VPS). Los pasos concretos de IIS están en la sección 4 porque usas Windows y SQL Server; si eliges otra opción, se ajusta esa sección.

---

## 1. Cómo se publica

- **Un solo sitio y un solo dominio** (decisión aprobada en la Fase 1): la API sirve también las pantallas compiladas.
  - Así la cookie de sesión (`SameSite=Strict`) y la protección CSRF funcionan sin abrir CORS.
  - Las rutas de la aplicación (por ejemplo `/entrenadora/clientes`) devuelven la página; las de `/api` nunca.
- **HTTPS obligatorio.** En producción:
  - las cookies de sesión y CSRF solo viajan por HTTPS;
  - `http://` redirige a `https://`;
  - se envía HSTS (el navegador recuerda usar siempre HTTPS).
- **Cabeceras de seguridad** en todas las respuestas: política de contenido (CSP) que solo permite código, estilos, imágenes y videos del propio dominio, `X-Frame-Options: DENY`, `nosniff`, `no-referrer` y `Cache-Control: no-store`.
  - Excepción: los archivos de `/assets` llevan una huella en el nombre y se guardan en caché un año.
- **Archivos privados** (fotos, imágenes y videos): en una carpeta del servidor **fuera** de la carpeta del sitio. Solo se entregan por la API, con sesión y permisos. No tienen dirección pública.

---

## 2. Variables de entorno

En ASP.NET Core, los dos puntos de la configuración se escriben como doble guion bajo en las variables de entorno (`Storage:LocalPath` → `Storage__LocalPath`).

### Obligatorias en producción

| Variable | Ejemplo | Para qué |
|---|---|---|
| `ASPNETCORE_ENVIRONMENT` | `Production` | Activa HTTPS obligatorio, HSTS y cookies seguras. |
| `ConnectionStrings__LBMethod` | `Server=SERVIDOR;Database=LBMethod;Trusted_Connection=True;TrustServerCertificate=True` | Conexión a SQL Server. **Secreto:** nunca en Git. |
| `Storage__LocalPath` | `D:\LBMethod\archivos` | Carpeta privada de fotos, imágenes y videos. Debe estar fuera de la carpeta del sitio. |
| `DataProtection__KeysPath` | `D:\LBMethod\llaves` | Llaves de las sesiones. Sin ella, cada reinicio cierra todas las sesiones. En Windows se cifran con DPAPI de la máquina. |

### Opcionales

| Variable | Valor por defecto | Para qué |
|---|---|---|
| `Frontend__Path` | carpeta `wwwroot` junto a la API | Dónde están las pantallas compiladas (`frontend\dist`). Si no hay `index.html`, solo se publica la API. |
| `AllowedHosts` | `*` | Recomendado: tu dominio (por ejemplo `app.lbmethod.mx`). |
| `ASPNETCORE_URLS` | lo define IIS o el hospedaje | Direcciones de escucha si se usa Kestrel directo. |
| `ASPNETCORE_HTTPS_PORT` | — | Puerto HTTPS para la redirección, si no es 443. |
| `Kestrel__Certificates__Default__Path` / `__Password` | — | Certificado HTTPS si se usa Kestrel directo (en IIS, el certificado se pone en IIS). La contraseña es **secreto**. |
| `Cors__AllowedOrigins__0` | ninguno | Solo si las pantallas se sirvieran desde **otro** dominio. Con un solo dominio no hace falta y es más seguro dejarlo vacío. |
| `Library__MaxImageBytes` | `5242880` (5 MB) | Tamaño máximo de imagen de ejercicio. |
| `Library__MaxVideoBytes` | `104857600` (100 MB) | Tamaño máximo de video de ejercicio. |
| `Tracking__MaxPhotoBytes` | `10485760` (10 MB) | Tamaño máximo de foto de progreso. |
| `Security__SessionLifetime` | `08:00:00` | Duración de la sesión. |
| `Security__SlidingExpiration` | `true` | La sesión se renueva mientras se usa. |
| `Security__SessionRevalidationSeconds` | `60` | Cada cuánto se revisa si la cuenta sigue activa (desactivar una cuenta la saca en ese tiempo). |
| `Security__MaxFailedLoginAttempts` | `5` | Intentos fallidos antes de bloquear la cuenta. |
| `Security__LockoutMinutes` | `15` | Minutos de bloqueo. |
| `Security__LoginRequestsPerMinute` | `10` | Intentos de inicio de sesión por minuto y por dirección IP. |

---

## 3. Preparar la publicación

En tu computadora (carpeta del proyecto):
```powershell
cd frontend
npm ci
npm run build
cd ..\backend
dotnet publish src/LBMethod.Api -c Release -o .\publicar
Copy-Item -Recurse -Force ..\frontend\dist .\publicar\wwwroot
```
La carpeta `backend\publicar` es lo que se copia al servidor. No contiene secretos: la conexión y las rutas se configuran en el servidor.

### Base de datos en producción
1. **Respaldo** de la base de producción (ver [respaldo-y-restauracion.md](respaldo-y-restauracion.md)).
2. Aplicar el script idempotente, que se puede ejecutar varias veces sin duplicar nada:
   ```powershell
   sqlcmd -S SERVIDOR -E -d LBMethod -I -b -i docs\sql\LBMethod_idempotent.sql
   ```
3. Las migraciones **nunca** se aplican solas al arrancar la aplicación (regla de la Fase 2).
4. Crear la cuenta de entrenadora, una sola vez:
   ```powershell
   dotnet LBMethod.Api.dll create-trainer tu-correo@dominio.com "Leilani"
   ```
   Se ejecuta en la carpeta publicada, con las mismas variables de entorno del sitio.

---

## 4. Ejemplo: servidor Windows con IIS

1. Instala el **.NET 10 Hosting Bundle** en el servidor y reinicia IIS (`iisreset`).
2. Copia `publicar` a `D:\LBMethod\app`.
3. Crea las carpetas `D:\LBMethod\archivos` y `D:\LBMethod\llaves`, **fuera** de `app`.
4. En IIS:
   - crea un grupo de aplicaciones `LBMethod` con «Sin código administrado»;
   - crea un sitio con ruta física `D:\LBMethod\app`;
   - agrega un enlace **https** con tu certificado.
5. **Permisos:** la identidad `IIS AppPool\LBMethod` necesita:
   - lectura en `app`;
   - lectura y escritura en `archivos` y `llaves`;
   - un inicio de sesión en SQL Server con permisos `db_datareader` y `db_datawriter` sobre la base.
6. **Variables de entorno** del sitio (Editor de configuración → `system.webServer/aspNetCore` → `environmentVariables`). Esto las guarda en el `web.config` **del servidor**, que no está en Git.
7. **Videos grandes:** IIS limita las subidas a unos 30 MB. Para videos de hasta 100 MB, en el `web.config` del servidor:
   ```xml
   <system.webServer>
     <security>
       <requestFiltering>
         <requestLimits maxAllowedContentLength="115343360" />
       </requestFiltering>
     </security>
   </system.webServer>
   ```
8. Abre `https://tu-dominio/` e inicia sesión.

### Si se usa un proxy delante (nginx, Cloudflare, balanceador)
Cuando otro equipo recibe el HTTPS y reenvía a la API por HTTP, la API cree que la conexión no es segura y rechaza el inicio de sesión. Hoy **no** está configurado el reenvío de cabeceras (`X-Forwarded-Proto`), porque depende del hospedaje (D6). Con IIS o Azure App Service no hace falta.

---

## 5. Comprobaciones después de desplegar

- [ ] `http://tu-dominio/` redirige a `https://`.
- [ ] La página carga y no hay errores en la consola del navegador.
- [ ] Iniciar sesión como entrenadora y como cliente de prueba.
- [ ] `https://tu-dominio/api/trainer/clients` sin sesión responde 401.
- [ ] Subir una foto de progreso y verla. Su dirección no funciona en una ventana privada sin sesión.
- [ ] Descargar el PDF de una rutina y un Excel.
- [ ] Reiniciar el sitio: la sesión sigue abierta (confirma que `DataProtection__KeysPath` está bien).
- [ ] Programar el respaldo diario (base, archivos y llaves).

---

## 6. Cómo se probó el modo producción

En el entorno de desarrollo, con la base y los archivos reales de prueba:
- Pantallas compiladas con `npm run build`, servidas por la API.
- `ASPNETCORE_ENVIRONMENT=Production`, HTTPS con un certificado de desarrollo y llaves de sesión en una carpeta.

| Comprobación | Resultado |
|---|---|
| `http://` | redirige (307) a `https://` |
| Rutas de la aplicación sin sesión | 200 con la página y la CSP |
| `/assets/...` | `Cache-Control: public, max-age=31536000, immutable` |
| `/api/...` sin sesión | 401, nunca la página |
| Petición que modifica datos sin token CSRF | 400 con mensaje en español |
| Petición CORS desde otro dominio | sin cabeceras `Access-Control-Allow-*` (bloqueada por el navegador) |
| `/assets/../../appsettings.json` | no sale del directorio: devuelve la página, no el archivo |

- HSTS no se envía a `localhost` (así lo hace ASP.NET Core a propósito). Con un dominio real sí se envía.
- Producción **sin** HTTPS no funciona: el inicio de sesión responde error 500. Es intencional, porque las cookies seguras exigen HTTPS. Por eso la sección 4 pide el enlace https.
- La regresión completa en el navegador también se ejecutó contra este modo producción: 7 de 7 pruebas y 189 de 189 verificaciones correctas, sin bloqueos de la CSP (detalle en el informe de entrega).
