# LB METHOD · Fase 8: Portal y registro del cliente

Estado: **entregada, pendiente de tu aprobación.** No se ha iniciado la Fase 9.

En esta fase el cliente ya puede, desde su celular, ver su rutina completa y registrar cada entrenamiento serie por serie. Todo sale de la API y de SQL Server: no hay datos de ejemplo. El cliente **nunca modifica la rutina maestra**: cada entrenamiento guarda su propia copia de lo que estaba indicado y, junto a ella, lo que realmente hizo.

---

## 1. Qué puede hacer el cliente

### Inicio
- **Entrenamiento en curso:** si dejó uno a medias, aparece arriba con el botón «Retomar entrenamiento».
- **Próximo entrenamiento:** el siguiente día de cada rutina vigente, con el botón «Empezar». Si tiene varias rutinas vigentes (por ejemplo gimnasio y casa), ve el siguiente día de cada una.
  - Si todos los días de la rutina tienen día de la semana asignado, se sugiere el que toca según la fecha.
  - Si no, se sugiere el día que sigue al último que entrenó (después del Día A, el Día B; después del último, vuelve al primero).
- **Esta semana:** de lunes a domingo, con hora del centro de México. Marca hoy, los días de rutina (○) y los días entrenados (✓).
- **Último entrenamiento:** día, rutina, fecha y avance, con enlace al detalle.
- **Rutina vigente:** como en la Fase 7, ahora con el enlace «Ver días y ejercicios».

### Mi rutina
- Cada rutina vigente o programada, con sus fechas y tus indicaciones.
- Los días y ejercicios **en el orden que indicaste**.
- Cada ejercicio muestra series, repeticiones, peso sugerido con unidad, descanso, tempo, RIR/RPE, tipo de serie, superserie y tus notas.
- Si definiste series detalladas, se ve cada serie con su tipo (por ejemplo, «Serie 1 · Calentamiento · 12 reps · 20 kg · 60 s descanso»).
- «Cómo hacerlo» abre las instrucciones, los consejos técnicos y **las imágenes y videos que subiste**. Los archivos privados se sirven por un endpoint protegido, y solo al cliente que tiene asignado ese ejercicio.
- Es de solo lectura: no tiene ningún campo para editar.
- La descarga en PDF queda para la Fase 10, como indica la guía.

### Registrar un entrenamiento
1. **Empezar:** desde el inicio o desde un día de la rutina.
2. **Por cada serie:**
   - Captura repeticiones y peso reales.
   - Cambia la unidad kg/lb con un toque. La unidad inicial es la que indicaste.
   - Marca la serie como hecha (✓).
   - Las casillas empiezan **vacías**: el objetivo se ve como guía, pero el sistema nunca rellena valores reales por su cuenta.
3. **Serie extra:** puede agregar una serie que no estaba indicada (queda marcada como «Serie extra») y quitarla. Las series que indicaste no se pueden quitar.
4. **Por ejercicio:** puede marcar «Ejercicio completado» y dejar un comentario.
5. **Al final:** un comentario general («¿Cómo te sentiste? ¿Alguna molestia?») y el botón «Finalizar». Si faltan ejercicios, se le avisa cuántos, y puede finalizar así.

**Guardado:**
- Se guarda **solo**, un segundo después de cada cambio, y también al salir de la pantalla o cambiar de aplicación. El botón «Guardar» sirve para forzarlo.
- La barra inferior muestra el estado: «Guardando…», «Guardado» o «Sin guardar».

**Entrenamientos incompletos:**
- Si cierra la app, recarga o cierra sesión, al volver encuentra el entrenamiento tal como lo dejó y lo retoma.
- Solo puede haber **un entrenamiento en curso a la vez**. SQL Server lo garantiza con un índice único.
- Si pulsa «Empezar» otra vez en el mismo día, se retoma el que ya existe en lugar de crear un duplicado.
- Para empezar otro día, primero debe terminar el que tiene abierto.

**Finalizado:** queda guardado de solo lectura y ya no acepta cambios.

### Mis entrenamientos
- Historial del más reciente al más antiguo, con estado (En curso / Finalizado) y avance.
- El detalle muestra, para cada serie, **lo indicado** («Objetivo: 8 reps · 40 kg · 120 s descanso») junto a **lo hecho**.

### Celular Android
- Diseñado primero para celular.
- Las casillas de captura, el botón de unidad y el ✓ miden al menos 44 px de alto.
- Se abre el teclado numérico.
- Los botones Guardar y Finalizar quedan fijos abajo.
- Sin desplazamiento horizontal.

---

## 2. Decisiones tomadas en esta fase

- **Varias rutinas vigentes a la vez:** es tu decisión de la Fase 7. Ya funcionaba así; el portal muestra todas.
- **Copia de lo prescrito por serie:** al empezar un entrenamiento se copia, por ejercicio y por serie, lo que estaba indicado: repeticiones, peso y unidad, descanso, RIR/RPE, tipo y notas.
  - Si después editas la rutina o publicas una versión nueva, el historial del cliente sigue mostrando lo que tenía indicado ese día.
  - Una prueba del servidor lo comprueba.
- **No se rellenan valores reales automáticamente**, para no registrar algo que el cliente no hizo.
- **Límites de captura** para evitar errores de dedo. Los valores fuera de rango se rechazan y se indica el campo exacto:
  - hasta 1000 repeticiones;
  - hasta 2000 de peso;
  - hasta 20 series extra por ejercicio.
- **Vista de la entrenadora sobre los entrenamientos:** los datos ya quedan guardados. La pantalla para que los revises (cargas, evolución) corresponde a «Seguimiento», en la Fase 9.

---

## 3. Pruebas realizadas

Todas se ejecutaron contra **SQL Server 2022 real**.

| Prueba | Resultado |
|---|---|
| Pruebas del servidor (integración) | **84 de 84 correctas** (79 anteriores + 5 nuevas) |
| Pruebas de pantallas (componentes) | **41 de 41 correctas** (35 anteriores + 6 nuevas) |
| Navegador real, portal y registro en celular Android (`e2e/portal.cjs`) | **36 de 36 verificaciones correctas** |
| Navegador real, regresión: rutinas / biblioteca / clientes / flujo general | **26/26, 24/24, 21/21 y 17/17** (sin regresiones) |
| Compilación y revisión de código (oxlint) | Sin errores ni advertencias |

**Las 5 pruebas nuevas del servidor cubren:**
- El cliente ve su rutina en orden, con todos los parámetros, y solo los medios autorizados.
- Registro serie por serie:
  - guardar incompleto;
  - cerrar sesión, volver a entrar y retomar sin duplicados;
  - series extra;
  - finalizar, y rechazo de cambios después de finalizar.
- El historial conserva lo prescrito aunque la rutina cambie después.
- El inicio calcula el próximo entrenamiento, la semana y el último con datos reales.
- Reglas y privacidad:
  - solo rutinas vigentes;
  - un entrenamiento en curso a la vez;
  - otro cliente recibe 404 en sesiones, asignaciones y medios ajenos;
  - la entrenadora no usa los endpoints del cliente.

**La prueba en navegador (celular Android simulado, 412 × 915) recorre:**
1. La entrenadora crea una rutina con imagen, series detalladas y dos días, y la asigna.
2. La clienta entra por primera vez y ve el inicio y su rutina (orden, parámetros, imagen protegida, sin campos editables).
3. Empieza el Día A y registra series, con un cambio a lb y un comentario. Se guarda solo.
4. **Recarga:** los datos siguen.
5. **Cierra sesión y vuelve a entrar:** retoma la misma sesión, y pulsar «Empezar» de nuevo no duplica.
6. Agrega una serie extra y finaliza con aviso de ejercicios pendientes.
7. El inicio muestra el último entrenamiento, hoy marcado como entrenado y el Día B como siguiente.
8. Historial y detalle: de solo lectura, con lo indicado junto a lo hecho, y la API rechaza cambios (409).
9. **Otra clienta:** no ve la rutina, recibe 404 en la sesión, la escritura, la imagen y la asignación ajenas, y la pantalla no muestra datos.
10. Un cliente recibe 403 en la API de la entrenadora.
11. **La rutina maestra quedó idéntica** antes y después.

Capturas en `fase-08/capturas`.

---

## 4. Base de datos

**Migración nueva:** `TrainingSetPrescription`.
- Es **solo aditiva**: agrega a cada serie registrada las columnas de lo indicado (si era serie indicada o extra, repeticiones, peso y unidad, descanso, RIR, RPE y notas).
- No borra ni cambia datos existentes.
- Antes de aplicarla se hizo **respaldo** de la base de desarrollo (`LBMethod_Dev_pre_fase8.bak`).
- Se regeneró el script idempotente `docs/sql/LBMethod_idempotent.sql`.

**En tu PC con Windows**, primero haz un respaldo de tu base y después, dentro de `backend`, ejecuta:
```powershell
dotnet ef database update -p src/LBMethod.Infrastructure
```
También puedes ejecutar el script con `sqlcmd -I -i docs\sql\LBMethod_idempotent.sql` sobre tu base.

---

## 5. Cambios en lo existente (revisados)

- `TrainingLogSet` (dominio): nuevas propiedades de lo prescrito. No se quitó nada.
- Inicio del portal: las tarjetas «Pendiente · Fase 8» se reemplazaron por las tarjetas reales.
  - La tarjeta «Semana» estaba marcada para la Fase 9; la semana básica se adelantó porque la guía la pide en el inicio de esta fase.
  - El calendario completo sigue en la Fase 9.
- Menú del cliente: «Mi rutina» y «Mis entrenamientos» ya no aparecen como pendientes.
- Tarjeta «Rutina vigente»: se cambió la marca «Días y ejercicios · Fase 8» por el enlace a «Mi rutina».
- Fase 7, documento: la sección 3 ahora registra tu decisión (varias rutinas vigentes a la vez).
- Prueba `e2e/clientes.cjs`: ahora espera a que lleguen los datos del perfil antes de leerlos. Falló una vez por ir más rápido que la pantalla. No era un error de la aplicación: la captura muestra el perfil completo.

## 6. Archivos nuevos

```
backend/src/LBMethod.Application/Training/
  TrainingModels.cs        (datos de captura y límites)
  TrainingService.cs       (empezar, guardar, retomar y finalizar)
backend/src/LBMethod.Api/Contracts/PortalContracts.cs
backend/src/LBMethod.Api/Controllers/Portal/TrainingController.cs
backend/src/LBMethod.Infrastructure/Persistence/Migrations/20261030210250_TrainingSetPrescription.cs
backend/tests/LBMethod.IntegrationTests/Api/TrainingPortalTests.cs
frontend/src/api/portal.ts
frontend/src/features/portal/
  TrainingPages.tsx        (inicio, Mi rutina, registro, historial)
  portalModel.ts
  training.css
frontend/src/test/portal.test.tsx
frontend/e2e/portal.cjs
```

## 7. Lo que falta (fases siguientes)

- **Fase 9:**
  - calendario completo;
  - medidas, evaluaciones y fotos privadas;
  - «Mi progreso»;
  - la vista de la entrenadora sobre los entrenamientos registrados (Seguimiento).
- **Fase 10:** descarga de la rutina en PDF.
- **Siguen pendientes de tu decisión:** almacenamiento definitivo de archivos (D3), hospedaje (D6) y videos (D7).
