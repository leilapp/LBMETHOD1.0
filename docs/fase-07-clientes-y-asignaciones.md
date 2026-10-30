# LB METHOD · Fase 7: Clientes y asignaciones

Estado: **entregada.** La decisión de la sección 3 ya está tomada (varias rutinas vigentes a la vez).

En esta fase se completa el perfil de cada cliente y se conectan las rutinas con los clientes. Cada asignación apunta a una **versión concreta** de una rutina publicada, tiene fechas y estado, y **nunca se borra**: queda en el historial.

---

## 1. Qué puedes hacer

### Lista de clientes (menú **Clientes**)
- Pestañas **Activos**, **Inactivos** y **Todos**, y buscador por nombre o correo.
- Cada cliente muestra su **programa vigente** o "Sin rutina vigente".
- El nombre abre la **ficha del cliente**.
- Siguen igual: crear cliente con contraseña temporal, restablecer contraseña y desactivar/reactivar.

### Ficha del cliente
- **Perfil:** estado, fecha de registro, teléfono, fecha de nacimiento, estatura, peso, experiencia, objetivo, lugar de entrenamiento, días disponibles, duración de sesión y limitaciones declaradas.
- **Editar perfil:** solo nombre, apellidos y correo son obligatorios. El resto es opcional.
  - El correo es único en todo el sistema.
  - Si cambias el correo, **también cambia el correo con el que el cliente entra a su portal**.
- **Observaciones privadas:** notas con fecha y hora. **Solo tú las ves**: el cliente nunca recibe ese dato, ni siquiera en las respuestas internas del sistema. Esto se comprobó con pruebas.
- **Programa:** la asignación actual y el **historial** de programas anteriores.

### Asignar una rutina
Se puede hacer desde dos lugares:
- **Ficha del cliente → Asignar rutina:** eliges la rutina y la versión.
- **Ficha de la rutina → Asignar a clientes:** eliges uno o varios clientes.

En ambos casos defines:
- **Versión:** por defecto la más reciente publicada. Puedes elegir una anterior.
- **Fecha de inicio:** por defecto hoy, en hora del centro de México.
- **Fecha de fin** (opcional). Si la rutina tiene duración, se te ofrece "terminaría el …" con el botón *Usar esa fecha*. No se aplica sola.
- **Indicaciones para el cliente** (opcional). **El cliente sí las ve** en su portal. Para notas privadas usa las observaciones.

**Reglas:**
- Solo se asignan **rutinas publicadas**. No se asignan plantillas, borradores ni rutinas archivadas.
- Solo se asigna a **clientes activos**.
- Asignar una rutina a varios clientes **no copia los ejercicios**: todos apuntan a la misma versión.

### Estados de una asignación
| Estado | Significado |
|---|---|
| **Programada** | Empieza en una fecha futura |
| **Vigente** | Ya empezó y no ha terminado |
| **Terminada** | Pasó su fecha de fin o la terminaste |
| **Cancelada** | La cancelaste antes de que empezara (por ejemplo, por error) |
| **Reemplazada** | Reservado para el cambio de programa (ver sección 3) |

- El estado se calcula con la fecha de hoy en Guanajuato. Una asignación pasa de programada a vigente y a terminada sola, según sus fechas.
- **Terminar / Cambiar fecha de fin:** eliges el último día. Si es hoy o antes, queda terminada. También sirve para extender o acortar un programa.
- **Cancelar:** solo para asignaciones que aún no empiezan. Una vigente se *termina*, no se cancela.
- Nada se borra. Todo queda en el historial y en la bitácora de auditoría.

### Versiones nuevas
- Si publicas una versión nueva de una rutina ya asignada, **la asignación no cambia sola**. Sigue en su versión, como pide la guía.
- La ficha del cliente avisa: "Hay una versión más nueva (versión 2)". El botón **Cambiar a versión 2** abre la asignación con esa versión preseleccionada.
- En la ficha de la rutina, el apartado **Asignada a** muestra qué clientes la tienen vigente y cuántas asignaciones anteriores hubo.

### Portal del cliente
- **Inicio:** la tarjeta "Rutina vigente" muestra su programa real, con fechas e indicaciones. Los días y ejercicios se verán en la Fase 8.
- **Mi perfil:** sus datos completos y la sección **Mis programas**, con su historial. No ve lo cancelado ni las observaciones privadas.
- Un cliente solo puede ver su propio perfil y sus propias asignaciones.

### Inicio de la entrenadora
El indicador "Programas asignados" ahora es real: **Clientes con programa vigente**, y cuántos activos no tienen rutina.

### Desactivar un cliente
Igual que antes, desactivar **no borra nada**. Se comprobó que se conservan sus asignaciones, observaciones y entrenamientos registrados. Mientras esté inactivo no se le pueden asignar rutinas nuevas.

---

## 2. Decisiones tomadas en esta fase

Estas decisiones aplican la guía sin cambiar la arquitectura:

1. **El estado se deduce de las fechas.** No hay tareas automáticas que cambien datos de noche. Terminada a mano, cancelada y reemplazada se guardan; programada, vigente y terminada por fecha se calculan con la fecha de hoy en Guanajuato.
2. **Las indicaciones de la asignación son visibles para el cliente.** El formulario lo dice claramente. Las notas privadas son las observaciones del perfil.
3. **El cliente no ve las asignaciones canceladas,** porque suelen ser errores de captura. Tú sí las ves en el historial.
4. **Cambiar el correo del perfil cambia el usuario de acceso.** Así no quedan dos correos distintos para la misma persona.
5. **Las observaciones privadas no se editan ni se borran** en esta fase, para conservar el historial. Si quieres poder corregirlas, se puede agregar.

## 3. Decisión tomada después de la entrega

**¿Un cliente puede tener más de una rutina vigente al mismo tiempo?** Decidiste que **sí**, por ejemplo gimnasio y casa. El sistema no termina ninguna rutina por su cuenta: tú terminas cada una manualmente con «Cambiar fecha de fin». Así funcionaba ya al entregar esta fase, por lo que no hubo que cambiar código.

---

## 4. Pruebas realizadas

Todas se ejecutaron contra **SQL Server 2022 real**.

| Prueba | Resultado |
|---|---|
| Pruebas del servidor (integración) | **79 de 79 correctas** (70 anteriores + 9 nuevas) |
| Pruebas de pantallas (componentes) | **35 de 35 correctas** (29 anteriores + 6 nuevas) |
| Navegador real, clientes y asignaciones (`e2e/clientes.cjs`) | **21 de 21 verificaciones correctas** |
| Navegador real, rutinas / biblioteca / flujo general | **26/26, 24/24 y 17/17** (sin regresiones) |
| Compilación de producción y revisión de código (oxlint) | Sin errores ni advertencias |

**Las 9 pruebas nuevas del servidor cubren:**
- Editar el perfil completo y recuperarlo de SQL Server, con errores por campo exacto.
- Cambio de correo: entra con el nuevo, ya no con el anterior, y no se permiten correos repetidos.
- Observaciones privadas: el cliente no las recibe en ninguna respuesta y recibe "prohibido" (403) si intenta pedirlas.
- Una versión asignada a dos clientes sin copiar ejercicios; cada cliente ve solo lo suyo.
- Rechazos:
  - borrador, plantilla y rutina archivada;
  - cliente inactivo;
  - fechas al revés;
  - sin clientes.
- Versión nueva sin alterar la asignación existente; cambio de programa conservando el historial.
- Cancelar una asignación futura y no poder cancelar una vigente.
- Desactivar un cliente conserva asignaciones, observaciones y entrenamientos.
- **Privacidad:** otra entrenadora recibe 404 en perfil, observaciones y asignaciones, y no puede cruzar clientes ni rutinas; un cliente recibe 403.

**La prueba en navegador recorre:**
- búsqueda, edición del perfil con validación, y observación privada;
- asignar desde el cliente, con la fecha sugerida;
- asignar desde la rutina a otro cliente;
- versión nueva con aviso, terminar, asignar a futuro y cancelar, y cambio de programa con historial completo;
- el portal del cliente en celular: rutina vigente, perfil y programas, sin observaciones privadas ni cancelados;
- revisión de desbordes en celular.

Las capturas están en `fase-07/capturas`.

---

## 5. Base de datos

**No hubo migración.** El perfil, las observaciones privadas y las asignaciones ya existían desde la Fase 2. Se comprobó que el modelo no tiene cambios pendientes. No hay nada que aplicar en tu PC por esta fase.

## 6. Cambios en lo existente (revisados)

- `GET /api/trainer/clients`: ahora incluye el programa vigente y la fecha de registro.
- `GET /api/portal/profile`: ahora incluye estatura, peso, experiencia, lugar, días y duración. Nunca incluye observaciones privadas.
- Servicio de cuentas: nueva operación para cambiar el correo de acceso del cliente.
- Pantalla Clientes: se quitó el aviso "llegará en la Fase 7"; se agregaron filtros, buscador y enlace a la ficha.
- Ficha de rutina: botón "Asignar a clientes" y apartado "Asignada a".
- Correcciones menores de la Fase 6:
  - la vista previa decía "1 días";
  - el botón de asignar compartía el estilo principal con "Editar".

## 7. Archivos nuevos

```
backend/src/LBMethod.Application/Clients/
  ClientModels.cs          (datos del perfil, etiquetas en español, estado real de una asignación)
  ClientService.cs         (perfil y observaciones privadas)
  AssignmentService.cs     (asignar, terminar, cancelar)
backend/src/LBMethod.Api/Contracts/ClientContracts.cs
backend/src/LBMethod.Api/Controllers/AssignmentQueries.cs
backend/src/LBMethod.Api/Controllers/Trainer/ClientProfilesController.cs
backend/src/LBMethod.Api/Controllers/Trainer/AssignmentsController.cs
backend/tests/LBMethod.IntegrationTests/Api/ClientAssignmentTests.cs
frontend/src/api/clients.ts
frontend/src/features/clients/
  ClientPages.tsx          (ficha, programa, historial, observaciones, editar perfil)
  AssignModal.tsx          (asignar desde cliente o desde rutina)
  clientModel.ts
  clients.css
frontend/src/test/clients.test.tsx
frontend/e2e/clientes.cjs
```

## 8. Lo que falta (fases siguientes)

- **Fase 8:** el cliente verá los días y ejercicios de su rutina vigente y registrará sus entrenamientos.
- **Fase 9:** calendario, medidas, evaluaciones y seguimiento.
- **Siguen pendientes de tu decisión:** almacenamiento definitivo de archivos (D3), hospedaje (D6) y videos (D7).
