# LB METHOD

Plataforma web de gestión de entrenamiento personal para una entrenadora (TRAINER) y sus clientes (CLIENT).

Stack aprobado: React + TypeScript + Vite · ASP.NET Core Web API + C# · SQL Server + Entity Framework Core · ASP.NET Core Identity.

El desarrollo avanza por fases según la guía maestra del proyecto; cada fase requiere aprobación antes de continuar.

## Documentación

- [Fase 1: análisis y arquitectura](docs/fase-01-analisis-y-arquitectura.md)
- [Fase 2: modelo de datos y persistencia](docs/fase-02-modelo-de-datos.md) (incluye cómo aplicar la migración en Windows)

## Estado

Fase 2 entregada, pendiente de aprobación. Existe el modelo de datos (backend/) con su migración inicial y pruebas; aún no hay API ni pantallas.

## Requisitos de desarrollo

- .NET 10 SDK
- SQL Server 2019 o posterior (Express o Developer)

```bash
cd backend
dotnet tool restore
dotnet build
# Pruebas: requieren LBMETHOD_TEST_SQL (cadena de conexión a un SQL Server de pruebas, sin base de datos)
dotnet test
```
