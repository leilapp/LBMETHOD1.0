# LB METHOD en Cloudflare · Plan y etapa 1

Estado: **etapa 1 entregada** (plan escrito y prueba pequeña). Me detengo aquí hasta tu aprobación, antes de rehacer lo demás.

## 1. La decisión

El 31 de octubre de 2026 decidiste que LB METHOD viva en Cloudflare, donde ya tienes conectado el repositorio («Hazlo»).

Esto **reemplaza** dos decisiones de la guía, por indicación tuya:
- «SQL Server es la base de datos principal» → ahora es **Cloudflare D1**.
- La API en **.NET 10** → ahora es **TypeScript en Cloudflare Workers**, porque Cloudflare no ejecuta .NET.

**Lo que no cambia:**
- Las pantallas (React).
- Las reglas de seguridad y de separación de datos entre clientes.
- No generar rutinas automáticamente.
- No usar datos simulados.
- Trabajar por etapas, con tu aprobación.

**La versión .NET + SQL Server sigue completa en el repositorio** (`backend/`), sin cambios. Lo nuevo está en la carpeta `cloudflare/`.

---

## 2. Cómo queda

```
Navegador ──► Cloudflare (tu dominio, HTTPS)
                └─ Worker «lbmethod»
                     ├─ /            pantallas React (las mismas de hoy)
                     ├─ /api/...     API en TypeScript (mismas direcciones y respuestas que la versión .NET)
                     ├─ D1           base de datos (SQLite administrado por Cloudflare)
                     └─ R2           fotos, imágenes y videos privados (etapa 2)
```

- **Un solo sitio, en el mismo dominio**, como en la Fase 1. La cookie de sesión y el token CSRF funcionan igual, sin abrir CORS.
- **La API conserva exactamente las mismas direcciones y respuestas.** Por eso las pantallas no se reescriben: solo se mueve lo que hay detrás.

| Antes (.NET + SQL Server) | Ahora (Cloudflare) |
|---|---|
| ASP.NET Core Web API | Worker con Hono (TypeScript) |
| SQL Server + Entity Framework, migraciones | D1 + migraciones SQL (`cloudflare/migrations`) |
| ASP.NET Identity (contraseñas PBKDF2) | PBKDF2-SHA256 con sal, 100 000 iteraciones (Web Crypto) |
| Cookie de sesión firmada | Token aleatorio en cookie `HttpOnly`, `Secure`, `SameSite=Strict`. En D1 solo se guarda su huella SHA‑256. |
| Antiforgery (CSRF) | Token firmado con HMAC y ligado a la sesión, en la cabecera `X-CSRF-TOKEN` (igual que hoy) |
| Carpeta privada en disco | R2, privado, servido solo por la API con permisos |
| User Secrets / variables de entorno | `wrangler secret put` (secretos) y `vars` en `wrangler.jsonc` |
| PDFsharp-MigraDoc / ClosedXML | Bibliotecas de JavaScript compatibles con Workers. Se eligen y prueban en la etapa 7, y te las presento antes. |

---

## 3. Qué incluye la etapa 1

- **Base D1** con cuentas, sesiones, clientes, límite de intentos y bitácora de auditoría (`migrations/0001_cuentas_y_clientes.sql`).
- **Inicio de sesión:**
  - inicio y cierre de sesión;
  - roles TRAINER y CLIENT;
  - contraseña temporal obligatoria de cambiar;
  - bloqueo tras 5 intentos fallidos durante 15 minutos;
  - límite de 10 intentos por minuto por dirección IP;
  - sesión de 8 h que se renueva mientras se usa.
- **Seguridad:**
  - token CSRF en toda operación que modifica datos;
  - cabeceras de seguridad (CSP y las demás de la versión .NET);
  - errores sin detalles internos.
- **Clientes (entrenadora):**
  - lista y alta con contraseña temporal;
  - restablecer contraseña;
  - habilitar o deshabilitar el acceso. Deshabilitar cierra la sesión del cliente **al instante**.
- **Separación de datos:** todas las consultas filtran por la entrenadora de la sesión. Un cliente ajeno responde 404.
- **Cuenta de entrenadora:** se crea con `npm run create-trainer`. La contraseña se escribe oculta y solo se guarda su hash.
- **Lo que aún no está migrado** responde «Esta función todavía no está disponible en la versión de Cloudflare» (código 501), con la misma regla de sesión y rol que tendrá.

### Pruebas realizadas (con D1 local, en `wrangler dev`)

| Prueba | Resultado |
|---|---|
| Pruebas automáticas de la API (`npm test`, base D1 nueva en cada ejecución) | **11 de 11 correctas** |
| Navegador real con las pantallas actuales (`test/pantallas.cjs`) | **12 de 12 correctas** |
| Revisión de tipos (TypeScript) | Sin errores |

**Las pruebas automáticas cubren:**
- **Cookies y base:** la cookie es segura, la base no guarda la contraseña ni el token, y el cierre de sesión funciona.
- **Mensajes:** correo inexistente y contraseña incorrecta dan el mismo mensaje.
- **Bloqueo y límite:** la cuenta se bloquea tras 5 intentos; el intento 11 en un minuto recibe 429.
- **CSRF:** se rechazan una petición sin token, con un token inventado, con el de otra sesión y con el anterior al inicio de sesión.
- **Clientes:**
  - alta con contraseña temporal y acentos;
  - correo repetido;
  - otra entrenadora no ve al cliente ni puede tocarlo (404).
- **Validación:** el error aparece en el campo exacto, y un texto con comillas o SQL se guarda como texto.
- **Cliente:**
  - debe cambiar la contraseña temporal;
  - recibe 403 en la API de la entrenadora;
  - deshabilitarlo lo saca al instante;
  - restablecer invalida la contraseña anterior;
  - todo queda en la bitácora.
- **Sitio:** las rutas de la aplicación cargan con CSP, los archivos con huella se guardan en caché y `/api` nunca devuelve la página.

**El recorrido en navegador** usa las mismas pantallas de hoy, sin modificarlas:
1. La entrenadora inicia sesión y la sesión sigue al recargar.
2. Crea a «Begoña Núñez Cloudflare» y ve su contraseña temporal.
3. La clienta aparece en la lista, que se vuelve a leer de D1.
4. La entrenadora cierra sesión.
5. Begoña entra desde un celular, crea su contraseña y llega a su portal.
6. Begoña no puede abrir las pantallas de la entrenadora.
7. No hubo bloqueos de la CSP.

**Lo que se ve incompleto:** las tarjetas del inicio de la entrenadora y del portal se quedan en «Cargando…». Usan funciones de etapas siguientes, como el seguimiento y la rutina.

---

## 4. Etapas siguientes (cada una con tu aprobación)

| Etapa | Contenido | Equivale a |
|---|---|---|
| 2 | Biblioteca de ejercicios bilingüe, grupos musculares, equipo, medios privados en **R2**, importación y exportación Excel | Fase 5 |
| 3 | Constructor manual de rutinas, borradores, versiones inmutables y plantillas | Fase 6 |
| 4 | Perfil completo del cliente, observaciones privadas, asignaciones (varias vigentes a la vez) | Fase 7 |
| 5 | Portal del cliente y registro de entrenamientos serie por serie | Fase 8 |
| 6 | Medidas, evaluaciones, fotos privadas, gráficas y calendario | Fase 9 |
| 7 | PDF y Excel | Fase 10 |
| 8 | Auditoría completa (pruebas de todos los endpoints), respaldos, publicación en tu cuenta y guía | Fase 10 |

En cada etapa se trasladan también las pruebas de la versión .NET correspondientes, y la regresión en navegador debe pasar completa al final.

---

## 5. Riesgos y límites que debes conocer

1. **Plan de pago de Workers (unos 5 USD al mes).** En el plan gratuito, cada petición tiene unos 10 ms de procesador. Verificar una contraseña con PBKDF2 o generar un PDF tarda más. Con el plan de pago el límite es de 30 s o más. Confirma el precio vigente en la página de Cloudflare.
2. **D1 es SQLite, no SQL Server.** Cada base admite hasta 10 GB, que alcanza de sobra para una entrenadora con sus clientes. Los pesos y medidas se guardarán sin perder decimales (en centésimas exactas).
3. **Respaldos:**
   - D1 permite volver a cualquier minuto de los últimos 30 días con el plan de pago (7 días en el gratuito). Esta función se llama *Time Travel*.
   - Además, se puede exportar la base con `wrangler d1 export`.
   - Las fotos en R2 necesitan su propia copia. Lo detallo en la etapa 8.
4. **Es una reescritura.** Volver a dejar todo como en la Fase 10 lleva varias semanas de trabajo por etapas.
5. **La conexión actual de Cloudflare con Git** debe ser un proyecto de **Workers** que publique desde la carpeta `cloudflare/` (sección 6). Un proyecto de Pages solo publicaría las pantallas.

---

## 6. Cómo probarlo y cómo se publicará

**En tu computadora** (Windows, PowerShell, con Node 22):
```powershell
cd cloudflare
npm ci
Copy-Item .dev.vars.example .dev.vars        # y pon un valor largo y aleatorio en APP_SECRET
npm run build                                 # compila las pantallas y las copia a cloudflare\public
npm run db:migrate:local                      # crea las tablas en la base D1 local
npm run create-trainer -- tu-correo@dominio.com "Leilani"
npm run dev                                   # abre http://localhost:8787
npm test                                      # pruebas automáticas
```

**En tu cuenta de Cloudflare.** Todavía no lo hice: espera tu aprobación. Requiere iniciar sesión en tu cuenta.
1. `npx wrangler login`
2. `npx wrangler d1 create lbmethod`. Copia el `database_id` que devuelve en `wrangler.jsonc`.
3. `npx wrangler secret put APP_SECRET`. Escribe un valor largo y aleatorio.
4. `npm run db:migrate:remote`
5. `npm run create-trainer -- tu-correo@dominio.com "Leilani" --remote`
6. **Publicar.** Hay dos formas:
   - con `npm run deploy`;
   - con la conexión a Git de un proyecto de Workers, configurado así:
     - directorio raíz `cloudflare`;
     - comando de compilación `npm ci && npm run build`;
     - comando de publicación `npx wrangler deploy`.
