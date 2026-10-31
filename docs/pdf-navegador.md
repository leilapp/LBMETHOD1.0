# LB METHOD · PDF de rutinas generado en el navegador

Cambio pedido por Leilani el 31/10/2026: generar los PDF desde el frontend con jsPDF y jspdf-autotable, sin afectar lo que ya funciona. **Está listo en la rama y probado; espera tu autorización** antes de cualquier paso siguiente (unirlo a la rama principal o publicarlo).

## 1. Cómo funcionaba antes

- Tres botones pedían el PDF al servidor:
  - la versión de una rutina, en su ficha;
  - la rutina asignada, en la ficha de la clienta;
  - «Descargar en PDF», en «Mi rutina» del portal.
- La versión .NET lo armaba con MigraDoc y fuentes DejaVu: encabezado con la marca, resumen, una tabla por día y pie con «Página X de Y».
- La versión Cloudflare no tenía PDF: esos endpoints respondían «no disponible».

## 2. ¿Puede hacerse en el navegador? Sí

- Las tres pantallas ya reciben de la API todos los datos de la rutina, con los permisos de quien la abre. El PDF se arma con esos mismos datos.
- jsPDF funciona en Chrome, Edge, Firefox y Safari, en computadora y en Android.
- Las fuentes estándar del PDF (Helvetica y Times) cubren todo el español: acentos, ñ, ü, ¿ ¡, comillas y guiones. Por eso no hace falta incluir fuentes, y el archivo pesa unos 15 KB.
- Las bibliotecas (unos 140 KB comprimidos) se descargan solo al pulsar el botón. El arranque de la app no se vuelve más lento.

## 3. Qué incluye el PDF (datos reales, mismo diseño)

- **Encabezado en cada página:**
  - «LB METHOD» en violeta y dorado;
  - el nombre del programa y el de la clienta;
  - una línea dorada debajo.
- **Resumen:** cliente, programa, objetivo, fechas, duración, días, estado, descripción e indicaciones.
- **Un bloque por día:**
  - título en violeta y día de la semana en dorado, con sus notas;
  - tabla con #, ejercicio (y su nombre en inglés), series, repeticiones, peso, descanso, tempo y RIR/RPE;
  - las superseries, en dorado;
  - una franja con las series detalladas (tipo, repeticiones, peso, descanso, esfuerzo y notas) y las notas del ejercicio.
- **Rutinas largas:** se reparten en varias páginas, y el encabezado de la tabla se repite en cada una.
- **Pie:** «Generado el … (hora del centro de México) · Página X de Y».
- **Nombre del archivo:** sin acentos ni espacios. Por ejemplo, `gluteo-y-pierna-v2.pdf` o `gluteo-y-pierna-begona-munoz.pdf`.

## 4. Seguridad y datos de otras clientas

- El PDF solo usa lo que la API ya autorizó:
  - la entrenadora, sus rutinas y asignaciones;
  - la clienta, solo sus programas vigentes o programados.
- El archivo se arma en el equipo y no se envía a ningún servidor.
- Probado en el navegador:
  - otra clienta no recibe la rutina ajena ni ve su botón;
  - una clienta recibe 403 al pedir rutinas de la entrenadora;
  - sin sesión, todo responde 401.

## 5. Qué no cambió

- Excel, registro de entrenamientos, seguimiento y demás pantallas siguen igual.
- En la versión .NET, los endpoints de PDF del servidor siguen existiendo y funcionando; solo dejan de usarse desde los botones.
- En Cloudflare siguen sin existir.

## 6. Pruebas

| Prueba | Resultado |
|---|---|
| Pruebas del frontend (`npm test`): 4 nuevas del PDF y la del portal actualizada | **52 de 52** |
| Recorrido real en navegador contra el Worker (`e2e/exportaciones.cjs`): PDF de versión, de asignación y del portal en un Android emulado (Pixel 7), más Excel y permisos | **19 de 19** |
| Validez de los archivos descargados | A4, 4 páginas; los abren sin errores `pdfinfo`, `pdftotext` y `pypdf` en modo estricto |
| Regresión en navegador de rutinas, clientes y portal (pantallas donde están los botones) | **26 de 26, 21 de 21 y 36 de 36** |
| Auditoría de endpoints de Cloudflare | Sin cambios: los 3 endpoints de PDF siguen sin existir en el servidor |

## 7. Lo que conviene que sepas

- **Emojis y símbolos poco comunes** (💪, →) no existen en las fuentes del PDF. Las flechas se cambian por «->» y los emojis se omiten, en lugar de salir como símbolos raros.
- **Bitácora:** el servidor ya no se entera de que se descargó un PDF, porque se genera en el equipo. Antes la versión .NET lo anotaba en la bitácora. Si quieres conservar ese registro, se puede agregar un aviso pequeño al servidor al descargar.
- **Teléfonos Android:** lo probé con Chrome emulando un Pixel 7. No pude probarlo en un teléfono físico. Al abrir la app publicada en tu celular, el archivo debe quedar en Descargas.
- **Alternativa más ligera que consideré:** imprimir la pantalla con «Guardar como PDF» del navegador. No usa bibliotecas, pero cada navegador y teléfono lo hace distinto y el diseño no queda garantizado. Por eso me quedé con jsPDF, como preferías.
