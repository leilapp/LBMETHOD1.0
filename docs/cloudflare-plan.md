# LB METHOD en Cloudflare · Plan, etapas 1 y 2

Estado: **etapa 2 entregada** (biblioteca de ejercicios, igual que la Fase 5). Me detengo aquí hasta tu aprobación para la etapa 3 (constructor de rutinas).

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
| PDFsharp-MigraDoc / ClosedXML | Excel: lector y escritor propios sobre `fflate` (etapa 2, mismo formato). PDF: biblioteca de JavaScript compatible con Workers; se elige y prueba en la etapa 7, y te la presento antes. |

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
| Pruebas automáticas de la API (`npm test`, base D1 nueva en cada ejecución) | **11 de 11 correctas** (en la etapa 2 se suman 11 más: 22 de 22) |
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

## 4. Qué incluye la etapa 2 (Fase 5: biblioteca de ejercicios)

La API responde igual que la versión .NET, así que las pantallas de la biblioteca funcionan sin cambios.

- **Tablas nuevas en D1** (`migrations/0002_biblioteca.sql`):
  - grupos musculares (vienen los 12 de la versión .NET), equipamiento y patrones de movimiento;
  - ejercicios con nombre en español y en inglés, tipo, dificultad, descripción, instrucciones, errores frecuentes y consejos;
  - músculo principal y secundarios, equipamiento, variantes, favoritos de cada entrenadora;
  - imágenes, videos y enlaces de cada ejercicio, y el registro de cada archivo guardado.
- **Catálogos:** la entrenadora agrega, renombra y desactiva grupos musculares, equipamiento y patrones. Nunca se borran, porque los ejercicios los siguen usando.
- **Ejercicios:**
  - alta y edición con el error en el campo exacto;
  - nombres únicos en español y en inglés, sin importar mayúsculas ni acentos, también contra ejercicios desactivados;
  - activar y desactivar (desactivar no cambia rutinas ni historial);
  - búsqueda en español o inglés sin acentos, con filtros por músculo, equipamiento, patrón, tipo, estado y favoritos, y por páginas;
  - variantes vinculadas en ambos sentidos.
  - **Nada se genera automáticamente:** la entrenadora escribe cada ejercicio.
- **Imágenes y videos en R2 (privado):**
  - imágenes JPG, PNG o WEBP hasta 5 MB; videos MP4 o WEBM hasta 90 MB;
  - el tipo se comprueba por el contenido real del archivo, no por la extensión;
  - cada archivo se guarda con un nombre aleatorio y **no tiene dirección pública**: solo se ve con sesión de entrenadora;
  - los videos se pueden adelantar sin descargarlos completos;
  - también se aceptan enlaces que empiecen con https (por ejemplo, un video no listado de YouTube);
  - al quitar un archivo se borra de R2 y su registro queda marcado como historial.
- **Excel:**
  - plantilla con las hojas Ejercicios, Catálogos e Instrucciones, columnas obligatorias en rojo y listas desplegables;
  - vista previa antes de guardar, con cada fila marcada como válida, duplicada o con error, y el motivo;
  - al guardar, solo entran las filas válidas, todas juntas o ninguna;
  - nunca se crean grupos musculares, equipamiento ni patrones de forma implícita;
  - exportación del catálogo con la columna Activo; todo se escribe como texto, así que una fórmula escrita en un nombre no se ejecuta al abrir el archivo.
- **Bitácora:** altas, ediciones, activaciones, archivos y enlaces quedan registrados.

### Pruebas realizadas

| Prueba | Resultado |
|---|---|
| Pruebas automáticas de la API (`npm test`, D1 y R2 locales nuevos en cada ejecución) | **22 de 22 correctas** (11 de la etapa 1 y 11 nuevas) |
| Recorrido en navegador de la Fase 5 (`frontend/e2e/biblioteca.cjs`) contra el Worker | **23 de 24 correctas** |
| Revisión de tipos (TypeScript) y revisión de dependencias (`npm audit`) | Sin errores ni vulnerabilidades |

**Las pruebas nuevas cubren:**
- **Catálogos:** los 12 grupos de inicio, alta, nombres repetidos sin acentos, renombrar y desactivar.
- **Permisos:** un cliente recibe 403 en toda la biblioteca y sin sesión se recibe 401, también para los archivos.
- **Ejercicios:**
  - validación por campo;
  - nombres repetidos en español, en inglés y entre idiomas, también contra desactivados;
  - edición y bitácora.
- **Búsqueda:**
  - sin acentos y en inglés;
  - cada filtro;
  - favoritos separados por entrenadora;
  - estado y páginas;
  - los signos % y _ se buscan como texto.
- **Variantes:** en ambos sentidos, sin repetirse ni apuntar a sí mismas.
- **Archivos:**
  - se rechaza un archivo disfrazado de imagen y uno demasiado grande;
  - el nombre se limpia;
  - la imagen se entrega completa y por partes;
  - los enlaces http se rechazan;
  - al borrar, el archivo deja de estar disponible.
- **Excel:**
  - la plantilla trae las hojas y las listas desplegables;
  - la vista previa no guarda nada;
  - al guardar entran solo las filas válidas;
  - importar dos veces no duplica;
  - se rechazan archivos que no son .xlsx, archivos dañados y archivos sin columnas obligatorias;
  - la exportación no contiene fórmulas.

**La única falla del recorrido en navegador es esperada.** El inicio de la entrenadora pide el panel de resumen (`/api/trainer/dashboard`), que llega en una etapa siguiente y por ahora responde 501. Eso deja un error en la consola del navegador. La biblioteca completa pasó:
- alta y edición con imagen;
- búsqueda y filtros;
- variantes y favoritos;
- importación y exportación en Excel;
- vista en celular.

### Decisiones técnicas de esta etapa

- **Excel sin bibliotecas pesadas.** Los Workers no pueden usar la biblioteca de Excel de la versión .NET. Escribí un lector y un escritor pequeños sobre `fflate`, una biblioteca de compresión. El formato del archivo es el mismo de la Fase 5.
- **Videos hasta 90 MB.** Cloudflare no acepta peticiones de más de 100 MB en los planes Free y Pro. Para videos más largos se puede usar un enlace https.
- **El espacio de archivos `lbmethod-media` debe crearse en tu cuenta antes de publicar** (sección 7, paso 2).
- **Los archivos pasan por el Worker.** No hay direcciones públicas ni firmadas: cada descarga revisa la sesión.

### Límites que conviene saber

- La importación acepta hasta 2,000 ejercicios por archivo y archivos de hasta 10 MB.
- Las fotos de progreso de los clientes (etapa 6) usarán el mismo espacio privado, con permisos por cliente.

---

## 5. Etapas siguientes (cada una con tu aprobación)

| Etapa | Contenido | Equivale a |
|---|---|---|
| 2 ✓ | Biblioteca de ejercicios bilingüe, grupos musculares, equipo, medios privados en **R2**, importación y exportación Excel (**entregada**, sección 4) | Fase 5 |
| 3 | Constructor manual de rutinas, borradores, versiones inmutables y plantillas | Fase 6 |
| 4 | Perfil completo del cliente, observaciones privadas, asignaciones (varias vigentes a la vez) | Fase 7 |
| 5 | Portal del cliente y registro de entrenamientos serie por serie | Fase 8 |
| 6 | Medidas, evaluaciones, fotos privadas, gráficas y calendario | Fase 9 |
| 7 | PDF y Excel | Fase 10 |
| 8 | Auditoría completa (pruebas de todos los endpoints), respaldos, publicación en tu cuenta y guía | Fase 10 |

En cada etapa se trasladan también las pruebas de la versión .NET correspondientes, y la regresión en navegador debe pasar completa al final.

---

## 6. Riesgos y límites que debes conocer

1. **Plan de pago de Workers (unos 5 USD al mes).** En el plan gratuito, cada petición tiene unos 10 ms de procesador. Verificar una contraseña con PBKDF2 o generar un PDF tarda más. Con el plan de pago el límite es de 30 s o más. Confirma el precio vigente en la página de Cloudflare.
2. **D1 es SQLite, no SQL Server.** Cada base admite hasta 10 GB, que alcanza de sobra para una entrenadora con sus clientes. Los pesos y medidas se guardarán sin perder decimales (en centésimas exactas).
3. **Respaldos:**
   - D1 permite volver a cualquier minuto de los últimos 30 días con el plan de pago (7 días en el gratuito). Esta función se llama *Time Travel*.
   - Además, se puede exportar la base con `wrangler d1 export`.
   - Las fotos en R2 necesitan su propia copia. Lo detallo en la etapa 8.
4. **Es una reescritura.** Volver a dejar todo como en la Fase 10 lleva varias semanas de trabajo por etapas.
5. **La conexión actual de Cloudflare con Git** debe ser un proyecto de **Workers** que publique desde la carpeta `cloudflare/` (sección 7). Un proyecto de Pages solo publicaría las pantallas.

---

## 7. Cómo probarlo y cómo se publicará

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
   Después crea el espacio privado de archivos: `npx wrangler r2 bucket create lbmethod-media`.
3. `npx wrangler secret put APP_SECRET`. Escribe un valor largo y aleatorio.
4. `npm run db:migrate:remote`
5. `npm run create-trainer -- tu-correo@dominio.com "Leilani" --remote`
6. **Publicar.** Hay dos formas:
   - con `npm run deploy`;
   - con la conexión a Git de un proyecto de Workers, configurado así:
     - directorio raíz `cloudflare`;
     - comando de compilación `npm ci && npm run build`;
     - comando de publicación `npx wrangler deploy`.
