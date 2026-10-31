# LB METHOD

Plataforma web de gestión de entrenamiento personal para una entrenadora (TRAINER) y sus clientes (CLIENT).

Stack aprobado: React + TypeScript + Vite · ASP.NET Core Web API + C# · SQL Server + Entity Framework Core · ASP.NET Core Identity.

El desarrollo avanza por fases según la guía maestra del proyecto; cada fase requiere aprobación antes de continuar.

## Documentación

- [Fase 1: análisis y arquitectura](docs/fase-01-analisis-y-arquitectura.md)
- [Fase 2: modelo de datos y persistencia](docs/fase-02-modelo-de-datos.md) (incluye cómo aplicar la migración en Windows)
- [Fase 3: autenticación, roles y seguridad](docs/fase-03-autenticacion-y-seguridad.md) (incluye cómo crear la cuenta de entrenadora y arrancar la API)
- [Fase 4: sistema visual y experiencia UI/UX](docs/fase-04-sistema-visual.md) (incluye cómo abrir las pantallas)
- [Fase 5: biblioteca de ejercicios](docs/fase-05-biblioteca.md) (incluye cómo aplicar la nueva migración)
- [Fase 6: constructor manual de rutinas](docs/fase-06-rutinas.md)
- [Fase 7: clientes y asignaciones](docs/fase-07-clientes-y-asignaciones.md)
- [Fase 8: portal y registro del cliente](docs/fase-08-portal-y-registro.md) (incluye cómo aplicar la nueva migración)
- [Fase 9: seguimiento](docs/fase-09-seguimiento.md) (sin migración nueva)
- [Fase 10: exportaciones, auditoría y entrega](docs/fase-10-entrega.md) (sin migración nueva; incluye limitaciones conocidas y decisiones pendientes)

Versión Cloudflare (en construcción por etapas, por decisión del 31/10/2026):
- [Plan y etapas 1 y 2: Workers + D1 + R2](docs/cloudflare-plan.md) (carpeta `cloudflare/`; la versión .NET + SQL Server sigue en `backend/`)

Guías de operación (versión .NET + SQL Server):
- [Instalación y ejecución en Windows](docs/instalacion.md)
- [Respaldo y restauración de SQL Server y archivos](docs/respaldo-y-restauracion.md)
- [Despliegue y variables de entorno](docs/despliegue.md)

## Estado

Las 10 fases de la guía están entregadas; la Fase 10 está pendiente de revisión y aprobación. Existen el modelo de datos, la API con inicio de sesión, roles y aislamiento de datos (backend/), las pantallas para entrenadora y cliente (frontend/), la biblioteca de ejercicios con medios privados e importación/exportación en Excel, el constructor manual de rutinas y plantillas con versiones, el perfil de clientes con asignación de rutinas e historial, el portal del cliente para ver su rutina y registrar sus entrenamientos serie por serie, el seguimiento (medidas, evaluaciones, fotos privadas, gráficas y calendario) y las exportaciones: PDF de la rutina y Excel de clientes, rutinas y evaluaciones.

## Requisitos de desarrollo

- .NET 10 SDK
- SQL Server 2019 o posterior (Express o Developer)
- Node.js 22 LTS o posterior (frontend)

```bash
cd backend
dotnet tool restore
dotnet build
# Pruebas: requieren LBMETHOD_TEST_SQL (cadena de conexión a un SQL Server de pruebas, sin base de datos)
dotnet test
```

```bash
cd frontend
npm install
npm run dev     # http://localhost:5173 (reenvía /api a la API en http://localhost:5062)
npm test
npm run build   # pantallas compiladas en dist/, que la API sirve en producción (ver docs/despliegue.md)
```
