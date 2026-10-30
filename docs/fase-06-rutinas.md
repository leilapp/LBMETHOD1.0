# LB METHOD · Fase 6: Constructor manual de rutinas

Estado: **entregada, pendiente de tu aprobación.** No se ha iniciado la Fase 7.

Con el constructor armas cada rutina **a mano**: tú eliges cada ejercicio, el orden y todos los parámetros. El sistema **no genera rutinas, no sugiere ejercicios y no rellena valores por su cuenta**. Un ejercicio recién agregado llega con todos sus campos vacíos.

---

## 1. Qué puedes hacer

En el menú hay dos secciones que funcionan igual:
- **Rutinas:** los programas que después asignarás a tus clientes. La asignación llega en la Fase 7.
- **Plantillas:** bases reutilizables para crear rutinas nuevas.

Cada sección tiene las pestañas **Activas** y **Archivadas**, y el botón **Nueva rutina** o **Nueva plantilla**.

### Crear
1. Escribe el nombre, el objetivo, la duración en semanas y la descripción. Solo el nombre es obligatorio.
2. Opcionalmente, elige una plantilla como punto de partida. Se copia completa y después la cambias como quieras.
3. Se abre el constructor.

### El constructor

**Días de entrenamiento**
- Cada día tiene un nombre (por ejemplo, "Día 1 - Glúteo"), un día de la semana opcional y notas.
- Puedes **agregar**, **duplicar** (copia todos sus ejercicios), **subir/bajar** y **quitar** días. Quitar un día que tiene ejercicios pide confirmación.

**Ejercicios**
- **+ Agregar ejercicio** abre la biblioteca. Puedes buscar en español o inglés, filtrar por grupo muscular y agregar varios seguidos.
- En cada ejercicio puedes **duplicar**, **quitar** y **reordenar**:
  - En computadora, arrastra el ejercicio desde el icono ⠿. También puedes llevarlo a otro día.
  - En celular, usa los botones ↑ ↓.

**Parámetros de cada ejercicio** (botón *Parámetros*)

| Campo | Regla |
|---|---|
| Series | Obligatorio, de 1 a 30 |
| Reps mín. / máx. | Opcionales; la máxima no puede ser menor que la mínima |
| Peso sugerido y unidad | Opcional, kg o lb |
| Descanso | Opcional, en segundos (hasta 1 hora) |
| Tempo | Opcional, por ejemplo 3-1-1-0 |
| RIR | Opcional, 0 a 10, enteros o medios (2.5) |
| RPE | Opcional, 1 a 10, enteros o medios |
| Tipo de serie | Efectiva, Calentamiento, Dropset, Al fallo, Rest-pause, Back-off u Otra |
| Superserie | Etiqueta corta (A, B, C1…); misma etiqueta = se hacen juntos |
| Notas técnicas | Texto libre |

- **Detallar serie por serie:** opción para dar a cada serie su propio tipo, reps, peso, descanso, RIR o RPE. Por ejemplo, una serie de calentamiento y tres efectivas, o un dropset con pesos distintos.
- **Superseries:** los ejercicios con la misma letra se muestran unidos con una barra morada. Para publicar, cada superserie debe tener al menos dos ejercicios en el mismo día.
- Los errores aparecen junto al campo exacto, y la tarjeta con el error se abre sola.
- **Los parámetros de la rutina no cambian el ejercicio de la biblioteca.**

**Barra inferior**
- **Guardar borrador:** guarda tu trabajo sin publicarlo. Puedes salir y seguir después.
- **Vista previa:** muestra la rutina tal como quedará.
- **Publicar:** guarda y publica la versión. Puedes dejar una nota del cambio.
- **Descartar borrador:** borra solo los cambios no publicados. Aparece únicamente cuando ya existe una versión publicada.
- Si intentas salir con cambios sin guardar, el navegador te avisa.

### Versiones (historial)
- **Una versión publicada queda fija para siempre.** La base de datos misma impide modificarla.
- Al **Editar** una rutina publicada se crea un borrador con el siguiente número de versión (v2, v3…). Las versiones anteriores no cambian.
- En la ficha de la rutina ves todas sus versiones, con fecha, hora (centro de México) y nota. Puedes abrir cualquiera para revisarla.
- Esto prepara la Fase 7: cada asignación apuntará a una versión concreta, y lo que ya entrenó un cliente nunca se altera.

### Duplicar, plantillas y archivar
- **Duplicar:** crea una rutina nueva e independiente con el contenido de la versión elegida.
- **Guardar como plantilla:** copia la rutina a Plantillas.
- **Usar plantilla:** crea una rutina a partir de una plantilla.
- **Archivar** pide confirmación. La rutina deja de aparecer en Activas, pero **no se borra nada** y puedes **restaurarla**.

---

## 2. Decisiones tomadas en esta fase

Estas decisiones aplican lo que pide la guía, sin cambiar la arquitectura aprobada.

1. **Borrador y publicación.** Una rutina tiene como máximo un borrador. Publicar lo convierte en versión fija.
2. **Sin valores por defecto.** El constructor no propone series, reps ni descansos. Solo "Efectiva" aparece preseleccionado como tipo de serie y "kg" como unidad. Ninguno de los dos cuenta si no escribes un peso.
3. **Validación en dos niveles.**
   - Un borrador se puede guardar incompleto, por ejemplo con un día aún sin ejercicios. Así no pierdes trabajo.
   - Para publicar, cada día debe tener ejercicios, ningún ejercicio puede estar desactivado en la biblioteca y cada superserie debe tener al menos dos ejercicios.
4. **Límites de seguridad:** 14 días por rutina, 40 ejercicios por día, 30 series por ejercicio y 104 semanas de duración.

---

## 3. Pruebas realizadas

Todas se ejecutaron contra **SQL Server 2022 real**.

| Prueba | Resultado |
|---|---|
| Pruebas del servidor (integración) | **70 de 70 correctas** (62 anteriores + 8 nuevas) |
| Pruebas de pantallas (componentes) | **29 de 29 correctas** (21 anteriores + 8 nuevas) |
| Navegador real, constructor (`e2e/rutinas.cjs`) | **26 de 26 verificaciones correctas** |
| Navegador real, biblioteca (`e2e/biblioteca.cjs`) | **24 de 24 correctas** (sin regresiones) |
| Navegador real, flujo general (`e2e/flujo-completo.cjs`) | **17 de 17 correctas** (sin regresiones) |
| Compilación de producción y revisión de código (oxlint) | Sin errores ni advertencias |

**La prueba en navegador real hace el recorrido completo:**
- Crear la rutina, agregar días y buscar ejercicios en la biblioteca.
- Comprobar que exige las series.
- Llenar los parámetros y la superserie.
- Reordenar arrastrando y con ↑ ↓.
- Duplicar días y ejercicios, y detallar serie por serie.
- **Guardar, recargar la página y recuperar todo desde SQL Server** (orden, parámetros y detalle por serie).
- Vista previa.
- Comprobar que **no deja publicar una superserie incompleta**.
- Publicar la v1; editar y publicar la v2; comprobar que **la v1 sigue intacta**.
- Guardar como plantilla, crear desde plantilla, duplicar y archivar con confirmación.
- Revisar la pantalla en celular sin desbordes.

**Pruebas del servidor nuevas:**
- Construir, guardar, recargar y reordenar, sin modificar el ejercicio maestro.
- Mensajes por campo exacto.
- Versión publicada inmutable y edición como v2.
- Ejercicio desactivado que impide publicar.
- Descartar borrador sin perder lo publicado.
- Duplicar y usar plantillas.
- Archivar y restaurar.
- **Privacidad:** otra entrenadora no ve tus rutinas (404) y un cliente no puede usar estas funciones (403).

**Problema encontrado y corregido durante las pruebas:** al publicar, la pantalla volvía a pedir el borrador antes de salir del constructor. Eso creaba una versión vacía de más. Se corrigió y la prueba en navegador lo vigila.

Las capturas están en la carpeta `fase-06/capturas`.

---

## 4. Base de datos

**No hubo migración.** Las tablas de rutinas, días, ejercicios, series y versiones ya existían desde la Fase 2, con sus reglas de integridad:
- versión publicada inmutable;
- un solo borrador por rutina;
- posiciones únicas;
- rangos de series, reps, RIR y RPE.

No hay nada que aplicar en tu PC por esta fase.

---

## 5. Cambios en lo existente (revisados)

- `IAppDbContext`: ahora expone las tablas de rutinas.
- Resultados de la biblioteca: se agregó el caso "conflicto" (409), por ejemplo al intentar editar una rutina archivada.
- Ventana modal: admite un tamaño ancho (selector de ejercicios). Se corrigió un detalle por el que el cursor podía saltar de campo mientras escribías dentro de una ventana.
- Menú: se quitó la marca "Fase 6" de Rutinas y Plantillas.
- Pruebas anteriores:
  - La verificación de "módulo pendiente" ahora usa Calendario (Fase 9).
  - Una verificación del perfil del cliente en celular se hizo más robusta, porque el menú lateral también muestra el nombre mientras se cierra.

## 6. Archivos nuevos

```
backend/src/LBMethod.Application/Routines/
  RoutineModels.cs        (datos de entrada, límites y etiquetas en español)
  RoutineService.cs       (crear, guardar borrador, publicar, versiones, duplicar, archivar)
backend/src/LBMethod.Api/Contracts/RoutineContracts.cs
backend/src/LBMethod.Api/Controllers/Trainer/RoutinesController.cs
backend/tests/LBMethod.IntegrationTests/Api/RoutineTests.cs
frontend/src/api/routines.ts
frontend/src/features/routines/
  routineModel.ts         (estado del constructor, validación, resumen de cada ejercicio)
  routineQueries.ts
  RoutinesPages.tsx       (listas, ficha, versiones, duplicar/plantilla/archivar)
  RoutineBuilderPage.tsx  (constructor, parámetros, serie por serie, selector, publicar)
  RoutinePreview.tsx      (vista previa de solo lectura)
  routines.css
frontend/src/test/routines.test.tsx
frontend/e2e/rutinas.cjs
```

## 7. Lo que falta (fases siguientes)

- **Fase 7:** asignar una versión publicada a un cliente, con fechas.
- **Fase 8:** que el cliente vea su rutina y registre su entrenamiento.
- **Fase 10:** exportar la rutina a PDF.
- **Siguen pendientes de tu decisión** las de fases anteriores: almacenamiento definitivo de archivos (D3), hospedaje (D6) y videos (D7).
