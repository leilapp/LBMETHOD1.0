# LB METHOD en Cloudflare · Plan y avance por etapas

Estado: **etapas 1 a 8 entregadas**, con el PDF generado en el navegador (jsPDF).

**Cambio del 31/10/2026 (noche): plan gratuito.** Pediste no pagar. Desde entonces:
- los archivos (imágenes, videos y fotos) se guardan en **Workers KV** en lugar de R2;
- los videos subidos son de hasta 25 MB (antes 90);
- las contraseñas usan 10 000 iteraciones (antes 100 000), para caber en los 10 ms de procesador del plan gratis.

Donde abajo dice R2 o 90 MB, es el plan original: lo vigente está en [cloudflare-publicacion.md](cloudflare-publicacion.md).

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
| Pruebas automáticas de la API (`npm test`, D1 y R2 locales nuevos en cada ejecución) | **22 de 22 correctas** (11 de la etapa 1 y 11 nuevas; con la etapa 3 son 31) |
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

## 4.1 Qué incluye la etapa 3 (Fase 6: constructor manual de rutinas)

Las pantallas de Rutinas y Plantillas funcionan sin cambios: la API responde igual que la versión .NET.

- **Tablas nuevas en D1** (`migrations/0003_rutinas.sql`): rutinas y plantillas, versiones, días, ejercicios de cada día y detalle serie por serie.
- **Nada se genera automáticamente.** Tú eliges cada día, ejercicio, orden y parámetro. Un ejercicio agregado llega vacío y el sistema no propone valores.
- **Constructor:**
  - borrador que se guarda completo, aunque esté incompleto;
  - series, repeticiones, peso con unidad, descanso, tempo, RIR, RPE, tipo de serie, superserie y notas;
  - detalle serie por serie;
  - errores junto al campo exacto (por ejemplo, el máximo de repeticiones del segundo ejercicio del día 1).
- **Publicar:** exige que cada día tenga ejercicios, que ningún ejercicio esté desactivado en la biblioteca y que cada superserie tenga al menos dos ejercicios.
- **Versiones:**
  - una versión publicada queda fija para siempre;
  - editar crea un borrador con el siguiente número (v2, v3…);
  - descartar un borrador no toca lo publicado.
- **Duplicar, guardar como plantilla, crear desde plantilla, archivar y restaurar.** Archivar no borra nada.
- **Privacidad:** cada entrenadora ve solo sus rutinas; para cualquier otra responden 404. Un cliente recibe 403.
- **Bitácora:** creación, borradores, publicación, descarte, archivo y restauración quedan registrados.

**Mejora respecto a la versión .NET.** La versión publicada ahora está protegida **en la base misma**. Unos disparadores de D1 (*triggers*) rechazan cualquier cambio, borrado o agregado en una versión publicada, aunque venga de un error del programa o de una consulta manual. En .NET esa protección vivía en el programa.

**Pesos sin perder decimales:** se guardan en centésimas exactas (60.25 kg se guarda como 6025).

### Pruebas realizadas

| Prueba | Resultado |
|---|---|
| Pruebas automáticas de la API (`npm test`) | **31 de 31 correctas** (22 anteriores y 9 nuevas) |
| Recorrido en navegador de la Fase 6 (`frontend/e2e/rutinas.cjs`) contra el Worker | **25 de 26 correctas** |
| Revisión de tipos (TypeScript) | Sin errores |

**Las pruebas nuevas cubren:**
- armar, guardar, recargar y reordenar, sin modificar el ejercicio de la biblioteca;
- el error en el campo exacto, también para valores con el tipo equivocado y listas demasiado largas;
- publicar, editar como v2 y comprobar que la v1 sigue intacta;
- **intentos de modificar directamente en la base una versión publicada**, que se rechazan;
- un ejercicio desactivado que impide publicar;
- descartar un borrador sin perder lo publicado;
- duplicar, plantillas, búsqueda sin acentos;
- archivar y restaurar;
- privacidad entre entrenadoras y bloqueo para clientes.

**La única falla del recorrido en navegador es esperada.** La ficha de la rutina pide la sección «Asignada a» y el inicio pide el panel de resumen. Las dos llegan en la etapa 4 y por ahora responden 501. El recorrido completo del constructor pasó, incluido publicar v1 y v2, plantillas, archivar y la vista en celular.

---

## 4.2 Qué incluye la etapa 4 (Fase 7: clientes y asignaciones)

Las pantallas de Clientes, la ficha del cliente, «Asignar a clientes» y el perfil del portal funcionan sin cambios.

- **Base D1** (`migrations/0004_perfil_y_asignaciones.sql`): solo agrega columnas y tablas. No cambia ni borra nada de lo existente.
- **Perfil completo del cliente:**
  - teléfono, fecha de nacimiento, estatura, peso, experiencia, objetivo, lugar, días disponibles, duración de sesión y limitaciones;
  - solo nombre, apellidos y correo son obligatorios;
  - estatura y peso en centésimas exactas;
  - cambiar el correo cambia también el correo para entrar al portal, y no se permiten correos repetidos.
- **Observaciones privadas:**
  - solo tú las ves; el cliente nunca las recibe;
  - no se editan ni se borran: **la base misma lo impide**.
- **Asignaciones:**
  - una versión publicada a uno o varios clientes, sin copiar los ejercicios;
  - fecha de inicio, fecha de fin opcional e indicaciones para el cliente;
  - estado calculado con la fecha de hoy en Guanajuato: programada, vigente o terminada;
  - terminar o cambiar la fecha de fin, y cancelar una asignación que aún no empieza;
  - **varias rutinas vigentes a la vez**; la lista de clientes las muestra juntas (por ejemplo, «Casa · Gimnasio»);
  - una versión nueva no cambia la asignación, y la ficha avisa que hay una más nueva.
- **Protecciones en la base:** solo se asignan versiones publicadas, la versión de una asignación no cambia y las asignaciones nunca se borran.
- **Portal:** el cliente ve su perfil y sus programas, sin lo cancelado ni las observaciones privadas.
- **Bitácora:** cambios de perfil, cambio de correo y cada asignación, término y cancelación.

### Pruebas realizadas

| Prueba | Resultado |
|---|---|
| Pruebas automáticas de la API (`npm test`) | **41 de 41 correctas** (31 anteriores y 10 nuevas) |
| Recorrido en navegador de la Fase 7 (`frontend/e2e/clientes.cjs`) contra el Worker | **20 de 21 correctas** |
| Revisión de tipos (TypeScript) | Sin errores |

**Las pruebas nuevas cubren:**
- perfil completo guardado y recuperado, con errores por campo exacto;
- cambio de correo: entra con el nuevo y no con el anterior; no se permite un correo repetido;
- observaciones privadas: el cliente no las recibe y la base impide borrarlas;
- una versión asignada a dos clientes sin copiar ejercicios;
- varias rutinas vigentes a la vez;
- rechazos: borrador, plantilla, rutina archivada, cliente inactivo, fechas al revés o inexistentes;
- versión nueva sin alterar la asignación; cambio de programa con historial;
- cancelar una asignación futura;
- desactivar un cliente conserva todo;
- privacidad entre entrenadoras y bloqueo para clientes.

**La única falla del recorrido en navegador es esperada.** El inicio de la entrenadora y el inicio del portal piden datos de las etapas 5 y 6, que por ahora responden 501. Todo lo de clientes y asignaciones pasó, incluido el portal en celular.

---

## 4.3 Qué incluye la etapa 5 (Fase 8: portal del cliente y registro de entrenamientos)

Las pantallas del portal (inicio, mi rutina, entrenar, historial y detalle) funcionan sin cambios.

- **Base D1** (`migrations/0005_entrenamientos.sql`): solo agrega tablas. No cambia ni borra nada de lo existente.
- **Mi rutina (solo lectura):**
  - las rutinas vigentes primero y luego las que están por empezar;
  - días y ejercicios en tu orden, con series, repeticiones, peso, descanso, tempo, RIR, RPE, notas, instrucciones y consejos técnicos;
  - las series detalladas con su tipo (calentamiento, efectiva, etc.);
  - las imágenes y videos privados solo se entregan si el ejercicio está en una rutina asignada a ese cliente.
- **Entrenar serie por serie:**
  - al iniciar se copia lo que prescribiste (instantánea), así el historial no cambia aunque después edites la rutina o el ejercicio;
  - el cliente anota repeticiones, peso (kg o lb), RIR, RPE, notas y si completó cada serie y cada ejercicio;
  - puede agregar series extra y quitarlas, pero **no puede quitar las series que tú indicaste**;
  - el guardado automático se puede repetir sin duplicar nada;
  - solo un entrenamiento en curso por cliente: al volver (aunque cierre sesión) retoma el mismo, y un doble toque no crea otro;
  - una rutina que aún no empieza o que ya terminó no se puede entrenar.
- **Inicio del portal:**
  - entrenamiento en curso para retomarlo;
  - próximo entrenamiento: si los días tienen día de la semana, el siguiente desde hoy que falta; si no, el que sigue al último entrenado;
  - la semana de lunes a domingo con lo planeado y lo hecho, y el último entrenamiento.
- **Historial:** hasta 200 entrenamientos, del más reciente al más antiguo, con su avance; el detalle muestra lo prescrito junto a lo hecho.
- **Protecciones en la base:** los entrenamientos nunca se borran; uno finalizado ya no cambia; lo prescrito no se edita; las series prescritas no se quitan.
- **Privacidad:** todo se resuelve con la sesión del cliente; lo de otro cliente responde «no encontrado» y la entrenadora no usa el portal.

### Pruebas realizadas

| Prueba | Resultado |
|---|---|
| Pruebas automáticas de la API (`npm test`) | **47 de 47 correctas** (41 anteriores y 6 nuevas) |
| Recorrido en navegador de la Fase 8 en un celular Android simulado (`frontend/e2e/portal.cjs`) contra el Worker | **35 de 36 correctas** |
| Revisión de tipos (TypeScript) | Sin errores |

**Las pruebas nuevas cubren:**
- la rutina del cliente con todos sus parámetros y solo los medios autorizados;
- registro serie por serie, guardado repetido sin duplicados, retomar tras cerrar sesión y finalizar;
- serie extra que se quita, serie prescrita que no se puede quitar;
- el historial conserva lo prescrito aunque cambien la rutina y el nombre del ejercicio, y la base impide borrarlo o cambiarlo;
- inicio: próximo entrenamiento (por día de la semana y por orden), semana y último entrenamiento;
- reglas: rutina por empezar, asignación ajena, errores por campo exacto;
- privacidad entre clientes y bloqueo para la entrenadora.

**La única falla del recorrido en navegador es esperada.** El inicio de la entrenadora pide el tablero de la etapa 6, que por ahora responde 501. Todo lo del portal pasó, incluido el uso en celular (controles de al menos 44 px y sin desbordes).

---

## 4.4 Qué incluye la etapa 6 (Fase 9: seguimiento, progreso y calendario)

Las pantallas de Seguimiento, la ficha de progreso, el Calendario, tu inicio y, en el portal, «Mi progreso» y «Mi calendario» funcionan sin cambios.

- **Base D1** (`migrations/0006_seguimiento.sql`): solo agrega tablas y una columna. No cambia ni borra nada de lo existente.
- **Tipos de medida:**
  - vienen los 7 de la guía (peso corporal, cintura, cadera, glúteos, muslo, brazo, pantorrilla) y puedes agregar más;
  - cada tipo solo acepta unidades coherentes (el peso corporal nunca en centímetros);
  - en cuanto hay medidas, su unidad ya no cambia, para no mezclar unidades en el historial (**la base misma lo impide**).
- **Evaluaciones y medidas:**
  - fecha (no futura), notas y medidas, con rangos para atrapar errores de captura (por ejemplo, 625 en lugar de 62.5 kg);
  - valores en centésimas exactas;
  - una medida mal capturada se corrige y el valor anterior queda en la bitácora; nada se borra;
  - si había una evaluación programada ese día en el calendario, queda como hecha y enlazada.
- **Fotos de progreso:**
  - en R2, privadas, sin dirección pública; solo las ven la clienta y su entrenadora;
  - se revisa el tipo real del archivo (JPG, PNG o WEBP) y el tamaño (10 MB).
- **Progreso (solo datos reales):**
  - una gráfica por tipo de medida, sin rellenar huecos;
  - cargas de los entrenamientos finalizados: la mejor serie de cada día, en la unidad más usada; lo registrado en otra unidad se convierte y se marca, conservando el valor original;
  - el peso corporal y las cargas nunca se mezclan;
  - frecuencia por semana (lunes a domingo) de las últimas 12 semanas.
- **Calendario:**
  - tus eventos (entrenamiento, descanso, evaluación, otro), con hora opcional; se marcan como hechos o se cancelan, nunca se borran;
  - inicio y fin de cada programa, los días de rutina y, cuando todos los días tienen día de la semana, los descansos;
  - los entrenamientos registrados y las evaluaciones;
  - la clienta ve solo lo suyo, sin cancelados ni eventos generales.
- **Tu inicio:** próximas evaluaciones (14 días) y actividad reciente real (entrenamientos y evaluaciones).
- **Tu seguimiento:** por clienta, programa vigente, última y próxima evaluación, último entrenamiento y entrenamientos de los últimos 30 días; puedes abrir cada entrenamiento con lo indicado y lo hecho.

### Pruebas realizadas

| Prueba | Resultado |
|---|---|
| Pruebas automáticas de la API (`npm test`) | **53 de 53 correctas** (47 anteriores y 6 nuevas) |
| Recorrido en navegador de la Fase 9 (`frontend/e2e/seguimiento.cjs`) contra el Worker | **47 de 47 correctas** |
| Revisión de tipos (TypeScript) | Sin errores |

**Las pruebas nuevas cubren:**
- tipos de medida con unidades coherentes, unidad fija con historial, desactivar sin perder historial;
- evaluaciones: fecha futura, valores fuera de rango, repetidas, más de dos decimales; corrección con bitácora («74.00 cm → 75 cm»);
- fotos: archivo falso, tamaño excesivo, fecha futura; acceso solo de la clienta y su entrenadora;
- progreso: peso corporal y cargas separados, conversión de lb marcada, entrenamientos sin terminar fuera de las cargas, frecuencia semanal;
- calendario: eventos, programas, días de rutina, descansos, entrenamientos y evaluaciones; permisos entre clientas y entrenadoras;
- inicio y resumen de seguimiento con las próximas evaluaciones;
- la base impide borrar medidas, evaluaciones, fotos y eventos.

Con tu inicio ya disponible, repetí los recorridos en navegador del portal (**36 de 36**) y de clientes (**21 de 21**): ya no queda ninguna falla esperada.

## 4.5 Qué incluye la etapa 7 (Fase 10: exportaciones)

- **Excel, listo:** clientes (perfil y asignaciones; nunca las observaciones privadas), rutinas (resumen y detalle de cada ejercicio y serie) y evaluaciones (una fila por medida). Fechas y números como fechas y números reales; todo texto queda como texto, así que nada que parezca fórmula se ejecuta. Cada exportación queda en la bitácora y solo incluye datos de la entrenadora que la pide.
- **PDF:** elegiste generarlo en el navegador con jsPDF y jspdf-autotable (31/10/2026). Hecho y probado en la rama, en espera de tu autorización; detalle en [pdf-navegador.md](pdf-navegador.md). Funciona igual con la versión .NET y con la de Cloudflare, porque solo usa datos que la API ya entrega.
- Pruebas: **2 nuevas** en `test/exportaciones.test.mjs` (contenido real leyendo el .xlsx, separación entre entrenadoras, sin fórmulas, cliente sin acceso). El recorrido en navegador de exportaciones se detiene en el PDF, como se espera.

## 4.6 Qué incluye la etapa 8 (auditoría, respaldos y publicación)

- **Auditoría de todos los endpoints** (`test/auditoria.test.mjs`): `scripts/endpoints-dotnet.mjs` lee los controladores de la versión .NET y saca la lista completa (**101 endpoints**). La prueba comprueba que cada uno existe en Cloudflare, que sin sesión responde 401, que un cliente recibe 403 en los de la entrenadora y la entrenadora 403 en los del portal, y que ninguno falla con error interno. Resultado: **todos presentes y protegidos**, salvo los 3 de PDF, que la prueba marca como pendientes y avisará en cuanto existan.
- **Respaldo y restauración** (`npm run backup` y `npm run restore`): base completa con historial y todos los archivos privados, con manifiesto de filas y huellas SHA-256. La restauración solo escribe en una base vacía y comprueba que todo quedó idéntico. `npm run db:migrate:remote` respalda antes de migrar.
- **Tu cuenta:** creé la base D1 `lbmethod` (vacía) y ajusté `wrangler.jsonc` al Worker `lbmethod1-0` que creó tu conexión de Git. R2 no está activado en tu cuenta y el secreto, las tablas y tu cuenta de entrenadora requieren tu inicio de sesión: los pasos están en [cloudflare-publicacion.md](cloudflare-publicacion.md).
- Pruebas automáticas de la API (`npm test`): **59 de 59 correctas** (53 anteriores, 2 de exportaciones y 4 de auditoría). Revisión de tipos sin errores.
- Si ya tenías una copia local de pruebas, vuelve a correr `npm run db:migrate:local`: la copia local depende del id de la base y empieza vacía con el id nuevo.

---

## 5. Etapas siguientes (cada una con tu aprobación)

| Etapa | Contenido | Equivale a |
|---|---|---|
| 2 ✓ | Biblioteca de ejercicios bilingüe, grupos musculares, equipo, medios privados en **R2**, importación y exportación Excel (**entregada**, sección 4) | Fase 5 |
| 3 ✓ | Constructor manual de rutinas, borradores, versiones inmutables y plantillas (**entregada**, sección 4.1) | Fase 6 |
| 4 ✓ | Perfil completo del cliente, observaciones privadas, asignaciones (varias vigentes a la vez) (**entregada**, sección 4.2) | Fase 7 |
| 5 ✓ | Portal del cliente y registro de entrenamientos serie por serie (**entregada**, sección 4.3) | Fase 8 |
| 6 ✓ | Medidas, evaluaciones, fotos privadas, gráficas y calendario (**entregada**, sección 4.4) | Fase 9 |
| 7 ✓ | Excel entregado; PDF en el navegador con jsPDF, esperando tu autorización (sección 4.5) | Fase 10 |
| 8 ✓ | Auditoría de los 101 endpoints, respaldos y guía de publicación (**entregada**, sección 4.6; faltan los pasos en tu cuenta que solo tú puedes hacer) | Fase 10 |

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

**En tu cuenta de Cloudflare:** la guía completa, con lo que ya hice (la base D1 creada) y los pasos que te tocan, está en [cloudflare-publicacion.md](cloudflare-publicacion.md).
