# LB METHOD · Fase 10: Exportaciones, auditoría y entrega

Estado: **entregada.** Esta es la última fase de la guía. El trabajo se detiene aquí hasta que lo revises y apruebes.

Esta fase agrega:
- el **PDF de la rutina**;
- las **exportaciones a Excel**;
- una **auditoría funcional y de seguridad** de toda la aplicación;
- la documentación de entrega:
  - [instalación](instalacion.md);
  - [respaldo y restauración](respaldo-y-restauracion.md);
  - [despliegue y variables de entorno](despliegue.md).

Todo lo que se marca como correcto se **ejecutó y comprobó** contra SQL Server 2022 real. Lo que no se pudo probar está en la sección 8.

---

## 1. PDF de la rutina

**Quién lo descarga:**
- **La entrenadora:**
  - cualquier versión de sus rutinas o plantillas, desde la página de la rutina («Descargar versión N en PDF»);
  - el PDF de una asignación concreta, desde el perfil del cliente («PDF»). Este incluye el nombre del cliente, las fechas, el estado y las indicaciones.
- **El cliente:** solo sus rutinas **vigentes o programadas**, desde «Mi rutina» → «Descargar en PDF».
  - Las rutinas terminadas o canceladas, y las de otros clientes, no se pueden descargar (respuesta 404).

**Qué contiene:**
- **Encabezado:** identidad **LB METHOD** en violeta y dorado, con el nombre de la rutina y del cliente.
- **Resumen:**
  - cliente, programa, objetivo y fechas;
  - duración en semanas, número de días y estado;
  - descripción e indicaciones.
- **Cada día:**
  - nombre y día de la semana, con sus notas;
  - tabla de ejercicios: orden, ejercicio, series, repeticiones, peso, descanso, tempo y RIR/RPE;
  - debajo de cada ejercicio, las **series detalladas** (por ejemplo «S2 Efectiva · 8 reps · 45 lb · 2 min»), la superserie y las notas.
- **Pie:** «Generado el … (hora del centro de México) · Página X de Y».

**Calidad comprobada:**
- **Acentos y ñ:** se usan fuentes incluidas en el proyecto, así que se ven igual en cualquier computadora. Se comprobó con «Glúteo», «Día» y «señal».
- **Paginación:** una rutina de 5 días × 8 ejercicios ocupó 4 páginas.
  - El encabezado de la tabla se repite en cada página.
  - Un ejercicio no se separa de su detalle.
- **Privacidad:**
  - el PDF de una versión sin asignar no muestra datos de ningún cliente;
  - no incluye notas privadas de la entrenadora.
- **Nombre del archivo:** sin espacios ni acentos, por ejemplo `version-gluteo-y-pierna-v1.pdf`.

**Biblioteca utilizada:** PDFsharp‑MigraDoc 6.2.4, con licencia MIT (gratuita, también para uso comercial), y fuentes DejaVu (licencia libre, incluida en el proyecto).
- Descarté QuestPDF porque exige licencia de pago según los ingresos de la empresa.

---

## 2. Exportaciones a Excel (solo la entrenadora)

| Exportación | Dónde | Hojas y contenido |
|---|---|---|
| **Clientes** | Clientes → «Exportar a Excel» | **Clientes:** datos de la ficha, si tiene cuenta y el programa vigente. **Asignaciones:** rutina, versión, fechas, estado e indicaciones. **No incluye** las observaciones privadas. |
| **Rutinas y plantillas** | Rutinas → «Exportar a Excel» | **Rutinas:** tipo, estado, versión publicada, borrador abierto y clientes con la rutina vigente. **Detalle:** cada ejercicio de la versión publicada (o del borrador si nunca se publicó) con todos sus parámetros y series detalladas. |
| **Evaluaciones** (todas) | Seguimiento → «Exportar evaluaciones a Excel» | Una fila por medida: cliente, fecha, medida, valor, unidad y notas. |
| **Evaluaciones de un cliente** | Seguimiento → cliente → «Exportar a Excel» | Igual, solo de ese cliente. |
| **Biblioteca** | Biblioteca (desde la Fase 5) | Ya existía, con plantilla, vista previa, validación e informe de errores al importar. |

**En todas:**
- Las fechas son fechas reales de Excel y los números son números, así que se pueden ordenar y sumar.
- **Seguridad:** un texto que empieza con «=» se guarda como texto y nunca se convierte en fórmula. Esto evita la inyección de fórmulas.
- **Formato:** encabezado fijo con filtros, en los colores de LB METHOD.
- **Separación:** solo salen los clientes y rutinas de la entrenadora que exporta.
- **Auditoría:** cada descarga de PDF o Excel queda registrada (quién, qué y cuándo).

---

## 3. Otros cambios de esta fase

- **Un solo sitio para producción:** la API sirve las pantallas compiladas en el mismo dominio, como se aprobó en la Fase 1. Las rutas de `/api` nunca devuelven la página.
- **Política de seguridad de contenido (CSP):** el navegador solo ejecuta código, estilos, imágenes y videos del propio dominio. Se probó la aplicación completa con esta política: sin bloqueos ni errores (sección 5).
- **Las sesiones sobreviven a reinicios:** si se configura `DataProtection:KeysPath`, reiniciar la API ya no cierra las sesiones. En Windows, las llaves se cifran con DPAPI.
- **Pruebas en navegador:** ahora aceptan `LBMETHOD_E2E_BASE` para ejecutarse contra cualquier dirección, incluido el modo producción.
- **`.gitignore`:** se agregó `backend/src/LBMethod.Api/wwwroot/` (pantallas compiladas que se copian al publicar).
- **No hubo migración.** Las exportaciones usan las tablas existentes, y se verificó que el modelo no tiene cambios pendientes.

---

## 4. Auditoría de seguridad

| Revisión | Cómo se comprobó | Resultado |
|---|---|---|
| **Autorización en cada endpoint** | Prueba automática nueva (`EndpointAuditTests`): recorre los **101 endpoints** de la API. | ✅ Cada endpoint de entrenadora exige el rol TRAINER y cada uno del portal el rol CLIENT. Solo 2 son públicos: obtener el token CSRF e iniciar sesión. |
| | Sin sesión, a todos los endpoints protegidos | ✅ 401 |
| | Cliente → endpoints de entrenadora; entrenadora → endpoints del portal | ✅ 403 |
| **Acceso cruzado entre clientes (IDOR)** | Pruebas de las Fases 3, 7, 8, 9 y 10 con dos clientes y dos entrenadoras | ✅ Un recurso ajeno responde 404, sin revelar si existe: perfil, rutinas, entrenamientos, evaluaciones, fotos, calendario y PDF. |
| **Archivos privados** | Pruebas de las Fases 5 y 9, y en navegador | ✅ Sin dirección pública: se piden por número a la API, que revisa sesión y dueño, y se entregan sin caché. Los archivos se guardan con nombres generados, fuera de la carpeta del sitio. Una ruta con `../` no sale de la carpeta de las pantallas. |
| **Validación de archivos** | Pruebas de las Fases 5 y 9 | ✅ Se revisa el contenido real, no solo la extensión: un «.png» falso se rechaza. También hay tamaño máximo. |
| **Validación de datos** | Pruebas de todas las fases | ✅ Rangos, decimales, fechas, textos obligatorios y longitudes, con el error en el campo exacto. |
| **Inyección SQL** | Revisión del código | ✅ Todas las consultas usan Entity Framework con parámetros. No hay SQL armado con texto del usuario. |
| **Inyección de fórmulas en Excel** | Prueba nueva | ✅ Un nombre «=HYPERLINK(...)» se exporta como texto. |
| **Sesiones** | Pruebas de la Fase 3 | ✅ Cookie `HttpOnly`, `SameSite=Strict` y `Secure` en producción. Expira a las 8 h. Desactivar la cuenta o restablecer la contraseña cierra sus sesiones en 60 s. Hay bloqueo tras 5 intentos fallidos y límite de 10 intentos por minuto. |
| **CSRF** | Pruebas de la Fase 3 y en modo producción | ✅ Toda operación que modifica datos sin token responde 400. |
| **CORS** | En modo producción | ✅ Una petición desde otro dominio no recibe permiso. |
| **Errores** | Pruebas de la Fase 3 y en modo producción | ✅ Nunca se muestran la pila, el SQL ni las rutas internas, solo un mensaje y un identificador. El detalle queda en el registro del servidor. |
| **Cabeceras** | Pruebas nuevas y en modo producción | ✅ CSP, `X-Frame-Options: DENY`, `nosniff`, `no-referrer` y `no-store`. HTTP redirige a HTTPS y se envía HSTS. |
| **Secretos en Git** | Búsqueda en todo el repositorio | ✅ No hay contraseñas ni cadenas de conexión reales. Se configuran con User Secrets o variables de entorno. |
| **Contraseñas** | Fase 3 | ✅ Solo se guardan cifradas con Identity (PBKDF2). La contraseña temporal obliga a cambiarla. |
| **Dependencias con vulnerabilidades conocidas** | `dotnet list package --vulnerable` y `npm audit` | ✅ 0 vulnerabilidades en el servidor y en las pantallas. |

---

## 5. Pruebas realizadas y resultados reales

Todas se ejecutaron contra **SQL Server 2022 real** (contenedor de desarrollo).

| Prueba | Resultado |
|---|---|
| Pruebas del servidor (integración) | **101 de 101 correctas** (90 anteriores + 11 nuevas) |
| Pruebas de pantallas (componentes) | **48 de 48 correctas** (47 anteriores + 1 nueva) |
| Compilación TypeScript y revisión de código (oxlint) | Sin errores ni advertencias |
| Navegador real, exportaciones (`e2e/exportaciones.cjs`, nueva) | **18 de 18 verificaciones correctas** |
| Reinicio completo de la API y de SQL Server (`e2e/persistencia.cjs`, nueva) | **5 de 5 correctas** |
| Respaldo, verificación y restauración de la base | Correctos (ver [respaldo-y-restauracion.md](respaldo-y-restauracion.md), sección 3) |
| **Regresión completa en modo producción** (pantallas compiladas servidas por la API, HTTPS y CSP) | **Las 7 pruebas en navegador correctas, 189 verificaciones:** seguimiento 47/47, portal 36/36, rutinas 26/26, biblioteca 24/24, clientes 21/21, flujo general 17/17 y exportaciones 18/18. Ningún bloqueo de la CSP en la consola. |

**Las 11 pruebas nuevas del servidor cubren:**
- **PDF:**
  - una rutina larga ocupa varias páginas y el nombre del archivo no lleva espacios;
  - solo lo descargan la entrenadora dueña y el cliente con la rutina vigente o programada;
  - 404 para otro cliente, para otra entrenadora y para el cliente cuando su asignación se cancela (la entrenadora conserva el acceso);
  - cada descarga queda en la bitácora de auditoría.
  - Los acentos, la identidad y «Página X de Y» se comprueban leyendo el PDF en la prueba en navegador.
- **Excel:**
  - contenido real de las tres exportaciones;
  - fechas y números con su tipo;
  - solo datos propios;
  - nunca fórmulas;
  - el cliente recibe 403.
- **Auditoría de endpoints:** las 3 pruebas de la sección 4.
- **Sitio único:**
  - las rutas de la aplicación cargan sin sesión y con CSP;
  - los archivos con huella se guardan en caché;
  - `/api` nunca devuelve la página (401 sin sesión, 404 con sesión).

**El recorrido nuevo en navegador** (`e2e/exportaciones.cjs`):
1. La entrenadora crea una rutina de 2 días con series detalladas y superserie, y descarga su PDF.
2. Se lee el texto del PDF y se convierte a imagen para revisarlo.
3. Crea una rutina de 5 días × 8 ejercicios y comprueba que se pagina.
4. Asigna la rutina a un cliente y descarga el PDF de la asignación.
5. Descarga los tres Excel y revisa su contenido.
6. **El cliente en el celular:**
   - descarga el PDF de su rutina vigente;
   - recibe 403 en las exportaciones de la entrenadora.
7. **Accesos ajenos:**
   - otro cliente recibe 404 en el PDF ajeno;
   - sin sesión no se descarga nada;
   - no hay errores en la consola.

### Verificación de las pruebas funcionales que pide la guía

| La guía pide probar | Dónde se prueba | Resultado |
|---|---|---|
| Inicio y cierre de sesión, roles | Fase 3 (servidor), `flujo-completo`, `clientes`, `portal` | ✅ |
| Altas, cambios y bajas de clientes y ejercicios | Fases 5 y 7 (servidor), `biblioteca`, `clientes` | ✅ |
| Constructor, versiones, plantillas y asignaciones | Fases 6 y 7, `rutinas`, `clientes` | ✅ |
| Portal y registro de entrenamientos | Fase 8, `portal` | ✅ |
| Evaluaciones, fotos, gráficas y calendario | Fase 9, `seguimiento` | ✅ |
| PDF y Excel | Fase 10, `exportaciones` | ✅ |
| Los datos sobreviven a reinicios | `persistencia` | ✅ |

---

## 6. Errores encontrados y corregidos en esta fase

1. **Producción, la página de inicio sin sesión respondía 401.** Al servir las pantallas desde la API, faltaba indicar que «/» es `index.html`. Además, el enrutamiento corría antes que los archivos estáticos.
   - **Corrección:** archivo predeterminado y orden correcto (archivos estáticos → enrutamiento → permisos).
   - Quedó cubierto por una prueba.
2. **Producción, los archivos `/assets` no se guardaban en caché**, por la misma causa. Corregido y probado.
3. **Prueba de Excel:** la prueba en navegador buscaba el valor en el XML sin considerar el prefijo `x:` que usa la biblioteca. Era un error de la prueba, no de la aplicación.
4. **Revisión de código:** dos pruebas en navegador declaraban una variable sin usar. Se quitó.
5. **Encontrado y documentado, no corregido:** en producción **sin HTTPS**, el inicio de sesión responde error 500. Es intencional, porque las cookies seguras exigen HTTPS. La guía de despliegue pide el enlace https y lo explica.

---

## 7. Lista de verificación final de la guía

| Punto | Estado |
|---|---|
| El inicio de sesión distingue TRAINER y CLIENT | ✅ |
| El backend impide el acceso cruzado entre clientes | ✅ (prueba automática de todos los endpoints) |
| Los ejercicios se guardan una vez y se reutilizan | ✅ |
| El catálogo está en español e inglés | ✅ |
| Las rutinas se construyen manualmente | ✅ (no hay generación automática) |
| Cada ejercicio de una rutina tiene sus propios parámetros | ✅ |
| Las versiones anteriores se conservan | ✅ |
| Los entrenamientos reales no cambian al editar la rutina | ✅ |
| El cliente registra peso y repeticiones por serie | ✅ |
| Las fotos de progreso son privadas | ✅ |
| Evaluaciones y gráficas usan datos reales | ✅ |
| El calendario muestra eventos guardados | ✅ |
| PDF y Excel usan información real | ✅ |
| Las migraciones funcionan y existe respaldo | ✅ |
| Pruebas documentadas y guía de instalación | ✅ |

---

## 8. Limitaciones conocidas

1. **Importar desde Excel solo existe para la biblioteca** (Fase 5). Clientes, rutinas y evaluaciones solo se exportan.
2. **El cliente no tiene exportaciones a Excel.** Solo descarga en PDF sus rutinas vigentes o programadas. Las terminadas puede verlas en pantalla, pero no descargarlas.
3. **El PDF es solo texto.** No incluye las imágenes ni los videos de los ejercicios.
4. **No probado en tu Windows.** Todo se probó en el entorno de desarrollo (Linux, SQL Server 2022 en contenedor). Los comandos de PowerShell de las guías siguen la documentación oficial, pero no los ejecuté en Windows. Conviene seguir [instalacion.md](instalacion.md) una vez en tu equipo.
5. **Sin proxy configurado.** Si el hospedaje pone un proxy que recibe el HTTPS y reenvía por HTTP (nginx, Cloudflare), hay que activar el reenvío de cabeceras. Depende de D6. Con IIS o Azure App Service no hace falta.
6. **Sin correos** (por tu decisión): las contraseñas temporales de los clientes se entregan a mano. No hay recuperación de contraseña por correo.
7. **Archivos en el disco del servidor** (D3): hay que respaldar la carpeta de archivos junto con la base de datos.
8. **Una sola entrenadora** (D8): la base de datos ya separa por entrenadora, pero no hay pantallas para administrar varias.
9. **El límite de intentos de inicio de sesión vive en la memoria del servidor.** Con varios servidores, cada uno lleva su propia cuenta, y se reinicia al reiniciar la API.
10. **Las pantallas se descargan en un solo archivo de unos 500 KB.** En un celular con mala señal, la primera carga tarda un poco más. Se puede dividir más adelante si hace falta.
11. **La bitácora de auditoría no tiene pantalla.** Se consulta directo en SQL Server (tabla `AuditLogs`).
12. **Las fotos de progreso no se pueden quitar** (decisión pendiente de la Fase 9).

---

## 9. Decisiones que necesitan tu aprobación

1. **Hospedaje (D6):** servidor Windows con IIS, Azure App Service + Azure SQL, o un VPS.
   - La guía de despliegue funciona para los tres, con el detalle de IIS.
   - Recomiendo **IIS en un servidor Windows** si ya tienes uno, porque usas Windows y SQL Server; si no, **Azure App Service + Azure SQL**, que incluye HTTPS y respaldos automáticos.
2. **Almacenamiento de archivos (D3):** seguir en el disco del servidor (hoy) o pasar a la nube (Azure Blob o S3). Conviene decidirlo junto con D6.
3. **Videos (D7):** hoy se pueden subir archivos y también poner enlaces. ¿Dejamos las dos opciones?
4. **Quitar una foto de progreso** (Fase 9, sección 4): dejarlo así, retirarla conservando el archivo (lo que recomiendo), o borrarla definitivamente.
5. **Biblioteca PDF:** confirma PDFsharp‑MigraDoc (MIT) en lugar de QuestPDF (licencia de pago según ingresos).

---

## 10. Archivos de esta fase

**Nuevos:**
```
backend/src/LBMethod.Application/Exports/
  ExportModels.cs               (modelos del PDF y de las hojas de Excel)
  ExportService.cs              (permisos, consultas y auditoría de cada exportación)
backend/src/LBMethod.Infrastructure/Files/
  MigraDocRoutinePdf.cs         (diseño del PDF)
  ClosedXmlTableExporter.cs     (Excel con tipos y sin fórmulas)
  Fonts/                        (DejaVu Sans y Serif, con su licencia)
backend/src/LBMethod.Api/Hosting/FrontendHosting.cs   (la API sirve las pantallas)
backend/src/LBMethod.Api/Controllers/Trainer/ExportsController.cs
backend/src/LBMethod.Api/Controllers/Portal/DocumentsController.cs
backend/tests/LBMethod.IntegrationTests/Api/
  ExportsTests.cs
  EndpointAuditTests.cs
  FrontendHostingTests.cs
frontend/src/components/DownloadButton.tsx
frontend/e2e/exportaciones.cjs
frontend/e2e/persistencia.cjs
docs/fase-10-entrega.md
docs/instalacion.md
docs/respaldo-y-restauracion.md
docs/despliegue.md
```

**Modificados (revisados, sin quitar funciones):**
- `Program.cs`:
  - registra las exportaciones;
  - llaves de sesión configurables;
  - sirve las pantallas;
  - orden del enrutamiento.
- `SecurityMiddleware.cs`: agrega la CSP.
- `DependencyInjection.cs` y `LBMethod.Infrastructure.csproj`: PDFsharp‑MigraDoc y fuentes incluidas.
- Pantallas con botones de descarga: `TrainingPages.tsx` (portal), `RoutinesPages.tsx`, `ClientPages.tsx`, `TrainerPages.tsx`, `TrackingPages.tsx` y `global.css`.
  - En «Mi rutina» se quitó el aviso «PDF · Fase 10».
- `client.ts`: comentario actualizado. `portal.test.tsx`: prueba de la descarga.
- Pruebas en navegador de fases anteriores: dirección configurable con `LBMETHOD_E2E_BASE`; se quitaron variables sin uso.
- `.gitignore` y `README.md`.

---

## 11. Siguiente paso

La guía termina en esta fase. **No avanzo con nada más** hasta que revises, apruebes y decidas los puntos de la sección 9.
