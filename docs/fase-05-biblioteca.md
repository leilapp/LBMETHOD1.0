# LB METHOD · Fase 5: Biblioteca de ejercicios

Estado: **entregada, pendiente de tu aprobación.** No se ha iniciado la Fase 6.

La biblioteca es el catálogo central: cada ejercicio se registra **una sola vez** y después las rutinas lo reutilizan. Aquí solo se guardan los datos del ejercicio. Las series, repeticiones, cargas y descansos los decides tú en cada rutina (Fase 6). El sistema **no genera rutinas ni sugiere ejercicios**.

---

## 1. Qué puedes hacer

Menú **Biblioteca**, con cuatro pestañas:

| Pestaña | Qué hace |
|---|---|
| **Ejercicios** | Buscar, filtrar, marcar favoritos y abrir la ficha de cada ejercicio. |
| **Grupos musculares** | Ver los 12 grupos iniciales de la guía. También puedes agregar, renombrar, desactivar o reactivar grupos. |
| **Equipamiento** | Lo mismo para barras, mancuernas, máquinas, etc. Arranca vacío: tú decides qué equipo existe. |
| **Patrones de movimiento** | Lo mismo para bisagra de cadera, sentadilla, empuje, etc. Arranca vacío. |

Además hay dos pantallas:
- **Nuevo ejercicio / Editar.**
- **Importar / exportar.**

### Datos de cada ejercicio (lo que pide la guía)
- **Identidad:**
  - Nombre en español (obligatorio).
  - Nombre en inglés.
  - Descripción.
- **Clasificación:**
  - Tipo (obligatorio): Fuerza, Movilidad, Cardio, Pliométrico, Isométrico, Estiramiento u Otro.
  - Dificultad (opcional).
  - Patrón de movimiento.
- **Músculos y equipo:**
  - Grupo muscular principal (obligatorio).
  - Músculos secundarios.
  - Equipamiento.
- **Técnica:**
  - Instrucciones de ejecución.
  - Errores frecuentes.
  - Consejos técnicos.
- **Medios y relaciones:**
  - Imágenes y videos.
  - Variantes relacionadas.
- **Estado:** activo o desactivado.

### Búsqueda y filtros
- **Búsqueda en español o inglés**, sin importar mayúsculas ni acentos: "elevacion" encuentra "Elevación".
- **Filtros** que se pueden combinar: grupo muscular, equipamiento, patrón de movimiento, estado (activos, desactivados o todos) y "solo mis favoritos".

### Sin duplicados
- No se pueden crear dos ejercicios con el mismo nombre. La comparación ignora mayúsculas, acentos y espacios de más. "Sentadilla Búlgara" y "sentadilla bulgara" cuentan como el mismo nombre.
- También se compara entre idiomas: si "Bulgarian split squat" ya es el nombre en inglés de un ejercicio, no puede usarse como nombre en español de otro.
- Un ejercicio desactivado también cuenta, para que no se dupliquen ejercicios "olvidados".
- Lo mismo aplica a los grupos musculares, el equipamiento y los patrones.

### Desactivar, nunca borrar
- **Desactivar** pide confirmación y oculta el ejercicio de la biblioteca.
- Las rutinas e historiales que ya lo usan **no cambian**. Esto se comprobó con una rutina publicada real en la base de datos.
- Puedes reactivarlo cuando quieras.
- Los grupos, el equipamiento y los patrones tampoco se borran. Al desactivarlos dejan de ofrecerse, pero los ejercicios que ya los tienen los conservan.

### Variantes
- Cada variante es un **ejercicio completo de la biblioteca**, con su propia ficha, nombre e historial. Por ejemplo, "Hip thrust unilateral" es variante de "Hip thrust con barra".
- El vínculo se ve en ambas fichas y puede llevar una nota, por ejemplo "una pierna".
- No se permite vincular un ejercicio consigo mismo ni repetir un vínculo.

### Favoritos
La estrella marca tus ejercicios de uso frecuente. Los favoritos son por usuario.

---

## 2. Imágenes y videos

| | Permitido | Tamaño máximo |
|---|---|---|
| Imágenes | JPG, PNG, WEBP | 5 MB |
| Videos | MP4, WEBM | 100 MB |
| Enlaces | Solo `https://` (por ejemplo, un video no listado de YouTube) | — |

**Seguridad de los archivos:**
- **El tipo se comprueba por el contenido real del archivo**, no por la extensión. Un archivo de texto renombrado como ".png" se rechaza.
- Los archivos se guardan en una **carpeta privada** del servidor, con un **nombre aleatorio**, fuera de cualquier carpeta pública. **No existen enlaces públicos.** Cada imagen o video se entrega solo a una sesión iniciada con permiso. Sin sesión, la respuesta es "no autorizado", y la cuenta de un cliente recibe "prohibido".
- Al eliminar un medio se borra el archivo físico. El registro queda marcado como eliminado, con fecha.
- No se inventan medios: un ejercicio sin imagen muestra su inicial y el texto "aún no tiene imágenes ni videos".
- Los límites se pueden cambiar en la configuración (`Library:MaxImageBytes`, `Library:MaxVideoBytes`) y la carpeta en `Storage:LocalPath`. Si no indicas carpeta, se usa `backend/src/LBMethod.Api/storage`, que está excluida de Git.

> Los clientes verán los videos de sus ejercicios en su portal en la **Fase 8**. Hoy solo la entrenadora tiene acceso.

---

## 3. Importar y exportar con Excel

1. **Descargar plantilla.** El archivo trae tres hojas:
   - *Ejercicios*: los encabezados, con una nota de ayuda en cada uno.
   - *Catálogos*: los grupos musculares, el equipamiento, los patrones, los tipos y las dificultades válidos, con listas desplegables.
   - *Instrucciones*: cómo llenarla.
2. **Llenarla.** Va un ejercicio por fila y son obligatorios NombreES, GrupoPrincipal y Tipo. Si una celda lleva varios músculos o varios equipos, se separan con punto y coma, por ejemplo: `Femoral; Abductores`.
3. **Revisar archivo.** Se muestra una **vista previa** con cada fila marcada como *Válida*, *Duplicada* o *Con errores*, y el motivo. En este paso **no se guarda nada**.
4. **Confirmar.** Se guardan **solo las filas válidas**, todas en una sola operación, y se muestra el **reporte de filas rechazadas**.

**Reglas de la importación:**
- Detecta duplicados contra la biblioteca y también dentro del mismo archivo. Indica en qué fila está el original.
- **Nunca crea** grupos musculares, equipamiento ni patrones nuevos. Si un nombre no existe en el catálogo, la fila se rechaza con el nombre exacto que falló. Así un error de escritura no termina como un grupo nuevo.
- Importar el mismo archivo dos veces no duplica nada.
- Las imágenes y videos se agregan después, desde la ficha de cada ejercicio.
- Límites: archivos `.xlsx` de hasta 10 MB y 2,000 filas.

**Exportar** descarga la biblioteca completa, solo los activos o solo los desactivados. Usa las mismas columnas de la plantilla, más la columna *Activo*.

---

## 4. Pruebas realizadas

Todas se ejecutaron contra **SQL Server 2022 real**.

| Prueba | Resultado |
|---|---|
| Pruebas del servidor (integración) | **62 de 62 correctas** (46 anteriores + 16 nuevas) |
| Pruebas de pantallas (componentes) | **21 de 21 correctas** (14 anteriores + 7 nuevas) |
| Navegador real, biblioteca (`e2e/biblioteca.cjs`) | **24 de 24 verificaciones correctas** |
| Navegador real, flujo de fases anteriores (`e2e/flujo-completo.cjs`) | **17 de 17 correctas** (sin regresiones) |
| Compilación de producción y revisión de código (oxlint) | Sin errores ni advertencias |

**Las 16 pruebas nuevas del servidor cubren:**
- Crear, editar y ver un ejercicio. Incluye cambiar el músculo principal por uno que era secundario.
- Datos inválidos, con mensajes por campo.
- Duplicados que ignoran mayúsculas, acentos, espacios e idioma.
- Búsqueda en español e inglés sin acentos, con filtros combinados.
- Desactivar sin romper una rutina publicada, y después reactivar.
- Favoritos por usuario.
- Variantes en ambos sentidos, sin vincular un ejercicio consigo mismo ni repetir vínculos.
- Imagen privada:
  - nombre aleatorio;
  - nombre peligroso del archivo limpiado (`../../`);
  - sin sesión, la descarga se rechaza (401);
  - al eliminarla se borra el archivo.
- Tipo falso, imagen demasiado grande y video demasiado grande.
- Enlaces solo con https.
- La cuenta de un cliente no puede usar ningún endpoint de la biblioteca (403).
- Administración de grupos, equipamiento y patrones sin duplicados.
- Plantilla con sus tres hojas.
- Importación con vista previa, guardado parcial y reimportación sin duplicar.
- Archivos que no son la plantilla.
- Exportación con el estado de cada ejercicio.

Las capturas de pantalla están en la carpeta `fase-05/capturas`. Incluyen escritorio y celular.

---

## 5. Base de datos

- **Migración nueva:** `LibraryCollation`.
  - Cambia la *intercalación* de las columnas de nombre (ejercicios, grupos, equipamiento y patrones) a `Latin1_General_100_CI_AI`, que ignora mayúsculas y acentos. Así SQL Server mismo impide duplicados como "Glúteos"/"gluteos" y la búsqueda funciona sin acentos.
  - No borra datos. Los índices únicos se reconstruyen automáticamente.
- Antes de aplicarla se hizo **respaldo** de la base de desarrollo (`BACKUP DATABASE`).
- Se regeneró el script idempotente `docs/sql/LBMethod_idempotent.sql`.

**En tu PC con Windows**, primero haz un respaldo de tu base y después, dentro de `backend`, ejecuta:
```powershell
dotnet ef database update -p src/LBMethod.Infrastructure
```
También puedes ejecutar el script con `sqlcmd -I -i docs\sql\LBMethod_idempotent.sql` sobre tu base.

---

## 6. Cambios en lo existente (revisados)

- `IAppDbContext`: expone las tablas de la biblioteca y una operación en transacción. Si ya hay una transacción abierta, se suma a ella; esto es lo que permite que la importación sea una sola operación.
- `Program.cs`: registra la biblioteca, el almacenamiento privado y el límite de tamaño de los formularios. El límite general de tamaño de las peticiones **no cambió**; solo la subida de medios lo amplía.
- `appsettings.json`: secciones nuevas `Library` y `Storage`.
- Cliente HTTP del frontend: ahora admite PUT, DELETE, subida de archivos y descargas protegidas.
- Menú: se quitó la marca "Fase 5" de Biblioteca.
- Pruebas anteriores: dos verificaciones que esperaban "Biblioteca pendiente" ahora usan "Rutinas", que sigue pendiente (Fase 6). También se corrigió una advertencia menor de oxlint en una prueba existente.

## 7. Archivos nuevos

```
backend/src/LBMethod.Application/Library/
  LibraryModels.cs              (resultados, etiquetas en español, normalización de nombres)
  ExerciseService.cs            (ejercicios, variantes, favoritos y catálogos)
  MediaService.cs               (imágenes, videos y enlaces)
  ExerciseSpreadsheet.cs        (contrato de Excel)
  ExerciseImportService.cs      (vista previa e importación)
backend/src/LBMethod.Infrastructure/Files/
  LocalFileStorage.cs           (carpeta privada, protegida contra rutas maliciosas)
  ClosedXmlExerciseSpreadsheet.cs (plantilla, lectura y exportación .xlsx)
backend/src/LBMethod.Infrastructure/Persistence/Configurations/Collations.cs
backend/src/LBMethod.Infrastructure/Persistence/Migrations/*_LibraryCollation.cs
backend/src/LBMethod.Api/Contracts/LibraryContracts.cs
backend/src/LBMethod.Api/Controllers/Trainer/Library/ (catálogos, ejercicios, medios, Excel)
backend/src/LBMethod.Api/Security/MediaUploadLimitAttribute.cs
backend/tests/LBMethod.IntegrationTests/Api/LibraryTests.cs
frontend/src/api/library.ts
frontend/src/features/library/ (lista, ficha, formulario, importar/exportar, estilos)
frontend/src/test/library.test.tsx
frontend/e2e/biblioteca.cjs
```

Librería nueva: **ClosedXML 0.105** (licencia MIT), para leer y escribir Excel sin necesitar Office instalado.

---

## 8. Pendientes y decisiones

- **D3, almacenamiento de archivos (pendiente de tu decisión).** Hoy se usa **disco local privado**, detrás de una interfaz (`IFileStorage`). Más adelante se puede cambiar a almacenamiento en la nube, como Azure Blob o S3, sin modificar pantallas ni datos. Lo definimos junto con el hosting (D6, Fase 10). En tu PC conviene respaldar la carpeta `storage` junto con la base de datos.
- **D7, videos.** Se implementaron **las dos opciones**: subir archivos y agregar enlaces https. Si prefieres solo una, se oculta la otra.
- **Equipamiento y patrones arrancan vacíos.** La guía solo define los grupos musculares iniciales. No cargué listas inventadas. Si quieres, me das tu lista y la cargo, o la importas tú desde la pestaña correspondiente.
- **Medios para clientes:** el acceso de los clientes a los videos de sus rutinas se construye en la Fase 8, junto con los permisos correspondientes.
- **Antivirus en archivos subidos:** hoy se valida el tipo real y el tamaño. Analizar los archivos con un antivirus del servidor se puede agregar al definir el hosting (Fase 10).
