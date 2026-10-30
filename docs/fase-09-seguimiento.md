# LB METHOD · Fase 9: Seguimiento

Estado: **entregada.** Por tu indicación («sigue con el siguiente paso cuando termines el 9»), se continúa directo con la Fase 10.

En esta fase la entrenadora registra medidas, evaluaciones y fotos privadas, revisa los entrenamientos de cada cliente y organiza un calendario. El cliente ve su progreso y su calendario **en modo de solo lectura**, como indica la guía («CLIENT: revisa únicamente su propio progreso»).

Todo sale de registros guardados en SQL Server. **No se inventan ni se interpolan datos:** si falta una medida se muestra «Sin dato», y una gráfica con un solo registro lo dice en lugar de trazar una tendencia.

---

## 1. Qué puede hacer la entrenadora

### Tipos de medida (Configuración)
- Vienen de inicio: peso corporal, cintura, cadera, glúteos, muslo, brazo y pantorrilla.
- Puede crear sus propios tipos (por ejemplo, «Muslo derecho» o «% de grasa»), editarlos y desactivarlos.
- **Unidades coherentes por tipo:**
  - peso corporal: kg o lb;
  - perímetros: cm o in;
  - composición corporal: %, kg o lb.
- En cuanto un tipo tiene registros, **ya no se le puede cambiar la unidad ni el tipo**. Así el historial nunca mezcla cm con in. Si necesita otra unidad, crea un tipo nuevo.
- Desactivar un tipo lo oculta para registros nuevos y **conserva su historial**. No se borra nada.

### Evaluaciones y medidas (Seguimiento → cliente)
- **Nueva evaluación:** fecha (no puede ser futura), las medidas que se tomaron y notas.
  - Las medidas que no se tomaron se dejan vacías. No se rellenan ni se estiman.
  - Cada valor se valida por unidad. Por ejemplo: cm de 1 a 300, kg de 1 a 500, % de 0.1 a 100, con máximo 2 decimales. El error aparece en el campo exacto.
  - Acepta coma decimal («68,5»).
- **Editar una evaluación:** cambiar fecha o notas, o agregar medidas que faltaron.
- **Corregir una medida:** queda registrada en la bitácora de auditoría con el valor anterior y el nuevo (por ejemplo, «74.00 cm → 75 cm»).
- Las **notas de la evaluación las ve el cliente**. Las observaciones privadas siguen en las notas de la ficha, que solo ve la entrenadora.
- Si había una **evaluación programada en el calendario ese día**, al registrarla se marca sola como «Hecho» y queda ligada.

### Fotos de progreso
- Formatos JPG, PNG o WEBP. Se revisa el contenido real del archivo, no solo la extensión: un archivo de texto renombrado a .png se rechaza.
- Tamaño máximo de 10 MB, configurable con `Tracking:MaxPhotoBytes`.
- Fecha, categoría opcional (Frente, Perfil, Espalda, Otra), evaluación opcional y nota.
- **Privadas:** se guardan fuera de cualquier carpeta pública y se sirven por un endpoint que revisa la sesión en cada petición.
  - La entrenadora ve las fotos de sus clientes.
  - El cliente ve solo las suyas.
  - Sin sesión, la respuesta es 401. Otro cliente recibe 404.
  - Se envían con `Cache-Control: no-store`, sin enlaces permanentes.

### Progreso del cliente (la misma vista que ve el cliente)
- **Resumen:** entrenamientos finalizados, cuántos en las últimas 12 semanas, último entrenamiento y última evaluación.
- **Peso corporal:** gráfica en el tiempo, con la aclaración de que **no es la carga de los ejercicios**.
- **Medidas:** una gráfica por medida y unidad. El espacio entre puntos respeta las fechas reales, y entre dos registros no se dibujan valores intermedios.
- **Comparar evaluaciones:** se eligen dos fechas («Desde» y «Hasta») y se ve cada medida con su diferencia. Si una medida no se tomó en alguna de las dos fechas, aparece «Sin dato» y no se calcula diferencia.
- **Cargas por ejercicio:** la mejor serie de cada entrenamiento finalizado, con repeticiones, volumen (peso × repeticiones) y número de series.
  - Si hay pesos registrados en lb y en kg, se muestran en la unidad más usada. Los convertidos se señalan y la tabla conserva el valor original (por ejemplo, «63.5 kg (registrado 140 lb)»).
- **Frecuencia:** entrenamientos finalizados por semana (lunes a domingo) de las últimas 12 semanas. Los que quedaron sin terminar se mencionan aparte y no se cuentan.
- **Fotos:** galería con filtro por categoría.
- Cada gráfica tiene **«Ver tabla»** con los mismos datos. Al pasar el cursor, o con las flechas del teclado, se ve la fecha y el valor de cada punto.

### Entrenamientos registrados
- Lista de los entrenamientos del cliente, en curso o finalizados.
- **Detalle de solo lectura:** para cada serie, lo indicado junto a lo hecho, con los comentarios del cliente. Cubre lo que quedó pendiente de la Fase 8.

### Calendario
- **Vista mensual** (cuadrícula de lunes a domingo, más la agenda del día elegido) y **vista semanal** (agenda día por día).
- **Eventos que crea la entrenadora:** entrenamiento programado, descanso, evaluación u otro, con hora opcional y notas. Pueden ser para un cliente o generales (solo para ella).
  - Un evento se puede editar mientras esté programado.
  - Se puede marcar como hecho o cancelar. **Nunca se borra:** un evento cancelado queda tachado como historial.
- **Lo que se calcula de datos guardados** (no se captura dos veces):
  - inicio y fin de cada programa asignado;
  - entrenamientos registrados;
  - evaluaciones;
  - al elegir un cliente, sus días de rutina, que se marcan «Hecho» si ese día entrenó.
- **Días de descanso automáticos:** solo cuando **todos** los días de sus rutinas vigentes tienen día de la semana asignado. Si no, no se suponen descansos.
- Cada tipo lleva su símbolo y su texto (○ día de rutina, ✓ entrenado, ◆ evaluación, – descanso…), no solo un color.

### Inicio (panel)
- Las tarjetas que decían «Pendiente · Fase 9» ahora muestran datos reales:
  - **Próximas evaluaciones** (14 días), desde el calendario;
  - **Actividad reciente**, con entrenamientos finalizados y evaluaciones.

## 2. Qué ve el cliente

- **Mi progreso:** la misma vista de progreso, sin botones para registrar ni corregir, más las notas de sus evaluaciones.
- **Mi calendario:**
  - vista semanal por defecto, cómoda en el celular, y vista mensual;
  - ve sus días de rutina, entrenamientos, descansos, evaluaciones y los eventos que le creaste, con sus notas;
  - **no ve** eventos cancelados, eventos generales de la entrenadora ni datos de otros clientes.
- El menú ya no marca «Mi progreso» ni «Mi calendario» como pendientes.

---

## 3. Decisiones tomadas en esta fase

- **El cliente no registra medidas ni fotos.** La guía define al cliente como de solo consulta para su progreso, así que todo lo registra la entrenadora.
- **No hizo falta migración.** Las tablas de medidas, evaluaciones, fotos y calendario ya existían desde la Fase 2 (se verificó que el modelo no tiene cambios pendientes). No hubo cambio de base de datos ni respaldo necesario.
- **Unidades:** cada medida copia la unidad de su tipo al guardarse. Las gráficas de medidas se agrupan por tipo y unidad. Las cargas solo se convierten entre kg y lb (1 lb = 0.45359237 kg), siempre señaladas.
- **Descansos automáticos** solo con días de la semana asignados en todas las rutinas vigentes. Si no, el calendario no adivina.
- **Rango del calendario:** máximo 62 días por consulta. Se rechazan peticiones mayores (400).

---

## 4. Decisión pendiente para ti

**¿Quitar una foto de progreso?** Hoy no se puede borrar ni ocultar una foto: se preserva todo el historial, como pide la guía. Opciones:
1. **Dejarlo así** (nada se borra).
2. **Retirar:** ocultarla al cliente y en las vistas, conservando el archivo y una nota de quién y cuándo. Es lo que recomiendo, por si se sube una foto equivocada.
3. **Borrado definitivo** del archivo, por ejemplo si el cliente lo pide por privacidad.

No implementé ninguna de las tres; dime cuál prefieres.

---

## 5. Pruebas realizadas

Todas se ejecutaron contra **SQL Server 2022 real**.

| Prueba | Resultado |
|---|---|
| Pruebas del servidor (integración) | **90 de 90 correctas** (84 anteriores + 6 nuevas) |
| Pruebas de pantallas (componentes) | **47 de 47 correctas** (41 anteriores + 6 nuevas) |
| Navegador real, seguimiento completo (`e2e/seguimiento.cjs`) | **47 de 47 verificaciones correctas** |
| Navegador real, regresión: portal / rutinas / biblioteca / clientes / flujo general | ver informe (sin regresiones) |
| Compilación y revisión de código (oxlint) | Sin errores ni advertencias |

**Las 6 pruebas nuevas del servidor cubren:**
- **Tipos de medida:**
  - unidades permitidas por tipo;
  - no se cambia la unidad con registros;
  - desactivar conserva el historial.
- **Evaluaciones:**
  - se rechazan una vacía, una con fecha futura, valores fuera de rango, más de 2 decimales y tipos repetidos o inactivos;
  - la corrección queda auditada.
- **Fotos:**
  - formato real, tamaño máximo;
  - acceso solo de la entrenadora y del propio cliente;
  - 404 para otro cliente y para otra entrenadora;
  - sin caché.
- **Progreso:**
  - sin mezclar unidades ni tipos;
  - conversión lb→kg señalada con el original;
  - entrenamientos sin terminar fuera de la frecuencia;
  - peso corporal separado de las cargas.
- **Calendario:**
  - combina eventos, programas, días de rutina, descansos, entrenamientos y evaluaciones;
  - la evaluación programada se completa sola;
  - el cliente no ve cancelados, generales ni nombres;
  - límites de rango.
- **Seguimiento y panel:** resumen por cliente, próximas evaluaciones y actividad reciente, solo de los clientes propios.

**El recorrido en navegador** (computadora para la entrenadora, celular Android 412 × 915 para el cliente):
1. La entrenadora crea un tipo de medida propio. Un perímetro solo ofrece cm o in.
2. Registra una evaluación hace 30 días. Un valor fuera de rango se marca en su campo, se corrige y se guarda.
3. Registra otra evaluación hoy, solo con el peso. La comparación muestra las dos fechas, «Sin dato» en las medidas no tomadas y la diferencia exacta.
4. Corrige una medida. Sube una foto. Un archivo falso «.png» se rechaza.
5. Las cargas avisan de la conversión desde lb y conservan el original. El detalle del entrenamiento muestra lo indicado frente a lo hecho.
6. Desactiva el tipo propio: la unidad queda bloqueada y el historial se conserva.
7. **Calendario:**
   - crea un evento con notas para el cliente y un descanso que luego cancela (queda tachado);
   - la evaluación programada de hoy quedó «Hecho»;
   - se ven días de rutina y descansos;
   - la vista mensual va de lunes a domingo;
   - un rango de 90 días se rechaza.
8. El panel muestra la próxima evaluación y la actividad reciente.
9. **Cliente en el celular:**
   - progreso con fechas y «Sin dato»;
   - su foto por su propia ruta protegida;
   - sin botones de edición;
   - la comparación cabe en la pantalla;
   - calendario semanal y mensual sin desbordes, sin eventos cancelados ni generales.
10. **Permisos:**
    - el cliente recibe 403 en la API de la entrenadora;
    - otro cliente recibe 404 en la foto ajena y no ve evaluaciones, medidas ni calendario ajenos;
    - sin sesión, la foto devuelve 401.
11. **Persistencia:** las evaluaciones y el evento ligado siguen en SQL Server con sus fechas.

Capturas en `fase-09/capturas`.

---

## 6. Cambios en lo existente (revisados)

- `IAppDbContext`: se agregaron las tablas de seguimiento que ya existían en el modelo. No se quitó nada.
- `Program.cs` y `MediaUploadLimitAttribute`: el límite de subida también contempla el de fotos.
- Portal, `TrainingController`: las consultas del detalle de entrenamientos se movieron a `SessionQueries` para que las use también la vista de la entrenadora. El comportamiento no cambió (las pruebas de la Fase 8 siguen pasando).
- Inicio de la entrenadora: «Pendiente · Fase 9» se reemplazó por próximas evaluaciones y actividad reciente.
- Configuración: ahora incluye «Tipos de medida» además del cambio de contraseña.
- Ficha del cliente: botón «Seguimiento».
- Menús: ya no queda ningún módulo marcado como pendiente.
- Pruebas `app.test.tsx` y `e2e/flujo-completo.cjs`: esperaban la marca «Pendiente · Fase 9». Ahora comprueban que el calendario ya está disponible.

## 7. Archivos nuevos

```
backend/src/LBMethod.Application/Tracking/
  TrackingModels.cs     (datos de entrada, unidades, rangos y resultados)
  TrackingService.cs    (tipos de medida, evaluaciones, correcciones y fotos)
  ProgressService.cs    (series de medidas, cargas y frecuencia)
  CalendarService.cs    (eventos y calendario combinado)
backend/src/LBMethod.Api/Contracts/TrackingContracts.cs
backend/src/LBMethod.Api/Controllers/SessionQueries.cs
backend/src/LBMethod.Api/Controllers/TrackingQueries.cs
backend/src/LBMethod.Api/Controllers/Trainer/TrackingController.cs
backend/src/LBMethod.Api/Controllers/Trainer/CalendarController.cs
backend/src/LBMethod.Api/Controllers/Portal/ProgressController.cs
backend/tests/LBMethod.IntegrationTests/Api/TrackingTests.cs
frontend/src/api/tracking.ts
frontend/src/features/tracking/
  charts.tsx            (gráficas propias en SVG, con tabla)
  ProgressView.tsx      (vista de progreso compartida)
  TrackingPages.tsx     (seguimiento, evaluaciones, fotos, entrenamientos, tipos de medida)
  CalendarPages.tsx     (calendario de la entrenadora y del cliente)
  trackingModel.ts
  tracking.css
frontend/src/test/tracking.test.tsx
frontend/e2e/seguimiento.cjs
```

## 8. Lo que falta

- **Fase 10:**
  - PDF de la rutina;
  - exportaciones a Excel (clientes, rutinas, evaluaciones);
  - auditoría funcional y de seguridad;
  - respaldo y guía de instalación.
- **Tu decisión** sobre retirar fotos (sección 4).
- **Siguen pendientes de tu decisión:** almacenamiento definitivo de archivos (D3), hospedaje (D6) y videos (D7).
