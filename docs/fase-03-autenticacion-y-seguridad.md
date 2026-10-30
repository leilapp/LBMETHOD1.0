# LB METHOD · Fase 3: Autenticación, roles y seguridad

> Estado: **entregada, pendiente de aprobación**. Incluye la API (ASP.NET Core 10) con inicio de sesión, roles TRAINER/CLIENT, cuentas de clientes creadas por la entrenadora y aislamiento estricto de datos. No incluye pantallas (Fase 4).
>
> Decisiones aplicadas: **sin envío de correos** y zona horaria **centro de México** (`America/Mexico_City`).

---

## 1. Cómo funciona, en lenguaje claro

- **No hay registro público.** La cuenta de la entrenadora se crea una sola vez desde la terminal. Las cuentas de clientes las crea la entrenadora desde la API.
- **Contraseña temporal:** al crear un cliente, el sistema genera una contraseña temporal aleatoria (14 caracteres) que se muestra **una sola vez** para que tú se la compartas. Mientras no la cambie, el cliente solo puede cambiar su contraseña o cerrar sesión.
- **¿Olvidó su contraseña?** Tú la restableces desde tu panel y le das una nueva temporal. Al hacerlo se cierran sus sesiones abiertas. (Sin correos por ahora; se puede agregar después sin cambiar el modelo).
- **Desactivar el acceso** de un cliente cierra sus sesiones y le impide entrar, **sin borrar ningún dato**. Se puede reactivar.
- **Sesión:** cookie segura (no accesible desde JavaScript), dura 8 horas y se renueva con el uso. Se revalida cada minuto en el servidor, así que desactivar o restablecer surte efecto de inmediato.
- **Intentos fallidos:** tras 5 contraseñas incorrectas la cuenta se bloquea 15 minutos. Además, máximo 10 intentos de inicio de sesión por minuto desde la misma conexión. El mensaje de error es siempre el mismo, para no revelar qué correos existen.

---

## 2. Endpoints

| Método y ruta | Quién | Qué hace |
|---|---|---|
| `GET /api/auth/csrf` | Cualquiera | Entrega el token anti-CSRF que el frontend envía en la cabecera `X-CSRF-TOKEN`. |
| `POST /api/auth/login` | Cualquiera | Inicia sesión con correo y contraseña. |
| `POST /api/auth/logout` | Con sesión | Cierra la sesión e invalida copias de la cookie. |
| `GET /api/auth/me` | Con sesión | Datos de la sesión: rol, si debe cambiar contraseña, Id de cliente. |
| `POST /api/auth/change-password` | Con sesión | Cambia la contraseña (pide la actual). |
| `GET /api/trainer/clients` | TRAINER | Lista **sus** clientes. |
| `GET /api/trainer/clients/{id}` | TRAINER | Un cliente suyo (404 si no es suyo). |
| `POST /api/trainer/clients` | TRAINER | Crea perfil básico + cuenta; devuelve la contraseña temporal. |
| `POST /api/trainer/clients/{id}/reset-password` | TRAINER | Nueva contraseña temporal; cierra sesiones. |
| `POST /api/trainer/clients/{id}/access` | TRAINER | Habilita o deshabilita el acceso. |
| `GET /api/portal/profile` | CLIENT | Su propio perfil (sin las notas privadas de la entrenadora). |

El perfil completo de clientes (objetivo, disponibilidad, notas privadas, etc.) es de la Fase 7. Aquí solo existe lo mínimo para crear cuentas y comprobar la seguridad.

---

## 3. Medidas de seguridad implementadas

| Requisito de la guía | Implementación |
|---|---|
| Cookies HttpOnly y Secure en producción; SameSite | Cookie `lb.session`: HttpOnly, `SameSite=Strict`, `Secure` obligatorio fuera de desarrollo. |
| CSRF | Toda operación que modifica datos (incluido el login) exige el token `X-CSRF-TOKEN`. El token queda ligado a la identidad: tras iniciar sesión hay que pedir uno nuevo. |
| Autorización en cada endpoint | Política global: **todo endpoint exige sesión** salvo que se marque explícitamente como público (solo `csrf` y `login`). Políticas por rol `Trainer` y `Client`. |
| Propiedad del recurso / IDOR | Clase única `ClientAccess`: la entrenadora solo ve clientes con su `TrainerId`; el cliente solo su propio perfil. El portal del cliente **no acepta Ids**: siempre usa la identidad de la sesión. Un recurso ajeno responde 404, sin revelar que existe. |
| Limitar intentos de login | Bloqueo de cuenta (5 intentos / 15 min) + límite por conexión (10/min, responde 429). |
| Validación de entradas | Validación en el servidor de cada solicitud (campos obligatorios, longitudes, formato de correo y teléfono). Política de contraseñas: mínimo 10 caracteres con mayúscula, minúscula y número. |
| CORS restringido | Solo orígenes configurados (en desarrollo, `http://localhost:5173`, que será el frontend). En producción, frontend y API irán en el mismo dominio. |
| No registrar datos sensibles | Los logs solo registran el Id del usuario y el resultado; nunca contraseñas, tokens ni correos de intentos fallidos. Verificado con una prueba que revisa todos los mensajes de log. |
| No exponer detalles internos | Respuestas de error estándar (`ProblemDetails`) sin pila ni mensajes técnicos; el detalle queda solo en el log del servidor. |
| Cabeceras de seguridad | `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Cache-Control: no-store`; HSTS y redirección a HTTPS en producción. |
| Bitácora | Crear cuenta, restablecer contraseña y habilitar/deshabilitar acceso quedan en `AuditLog`. |

---

## 4. Pruebas

Entorno: API completa en memoria contra **SQL Server 2022 real** (base temporal por ejecución), .NET 10.

**Resultado: 46 de 46 pruebas aprobadas** (24 de la Fase 2 + 22 nuevas de seguridad).

| Prueba obligatoria de la guía | Prueba automática | Resultado |
|---|---|---|
| TRAINER puede administrar | La entrenadora inicia sesión, crea cliente, lista, restablece contraseña y habilita/deshabilita | ✅ |
| CLIENT no accede a endpoints administrativos | El cliente recibe 403 al listar, consultar, crear, restablecer o deshabilitar | ✅ |
| Cliente A no lee ni modifica datos de B cambiando IDs o URLs | Cada cliente ve solo su perfil; pasar el Id de B en la ruta o en la consulta no cambia nada; los endpoints con Id de B dan 403 | ✅ |
| (extra) Entrenadora no accede a clientes de otra entrenadora | 404 al consultar, restablecer o deshabilitar; no aparece en su lista | ✅ |
| Sesión expirada | Con duración de 2 s, la sesión deja de funcionar al vencer | ✅ |
| Logout | Tras cerrar sesión, ni la sesión ni una **copia robada de la cookie** funcionan | ✅ |
| Endpoints no autenticados | 401 en todos los endpoints protegidos, de lectura y de escritura | ✅ (5 casos) |
| CSRF | Login sin token: 400. Token anterior al login: 400. Sin cabecera: 400. Con token válido: éxito | ✅ |
| Permisos en lectura, creación, edición | Cubiertos en las pruebas de roles y de propiedad | ✅ |
| Contraseña temporal | Debe cambiarse antes de usar el portal; contraseña débil rechazada; la temporal anterior deja de servir tras un restablecimiento | ✅ |
| Desactivar cliente | Cierra su sesión abierta, impide entrar y al reactivar recupera el acceso | ✅ |
| Bloqueo por intentos | Tras 5 fallos ni la contraseña correcta entra; mismo mensaje para correo inexistente | ✅ |
| Límite de solicitudes | 4.ª solicitud de login en un minuto (límite 3 en la prueba) → 429 | ✅ |
| Logs sin datos sensibles | Ningún log contiene la contraseña de la entrenadora, una contraseña errónea, la del cliente ni la temporal | ✅ |
| Errores sin detalles internos | JSON malformado → 400 sin nombres de excepciones ni pila | ✅ |
| CORS | Origen permitido recibe permiso; origen malicioso no | ✅ |
| Cookie segura | `HttpOnly` y `SameSite=Strict` | ✅ |
| Entradas inválidas y correo duplicado | 400 y 409 respectivamente | ✅ |

Prueba manual adicional: arranqué la API real en modo desarrollo contra la base `LBMethod_Dev` de la nube, creé una entrenadora de prueba con el comando de terminal y verifiqué con `curl`: login sin CSRF → 400, login → 200, `/me` → 200, portal como entrenadora → 403, y la contraseña no aparece en el log. (Esa cuenta de prueba existe solo en mi entorno en la nube, no en tu SQL Server).

---

## 5. Cómo usarlo en tu computadora (Windows)

En PowerShell, dentro de `backend`:

```powershell
dotnet tool restore

# 1) Cadena de conexión (se guarda fuera del proyecto, en los User Secrets de tu usuario de Windows)
dotnet user-secrets set "ConnectionStrings:LBMethod" "Server=localhost\SQLEXPRESS;Database=LBMethod_Dev;Trusted_Connection=True;TrustServerCertificate=True" --project src/LBMethod.Api

# 2) Aplicar migraciones (incluye la nueva AccountSecurity). Respalda antes si ya tienes datos (ver Fase 2).
$env:ConnectionStrings__LBMethod = "Server=localhost\SQLEXPRESS;Database=LBMethod_Dev;Trusted_Connection=True;TrustServerCertificate=True"
dotnet ef database update -p src/LBMethod.Infrastructure

# 3) Crear TU cuenta de entrenadora (te pedirá la contraseña de forma oculta)
dotnet run --project src/LBMethod.Api -- create-trainer tu-correo@dominio.com "Leilani"

# 4) Arrancar la API (http://localhost:5062)
dotnet run --project src/LBMethod.Api
```

Si tu servidor no es `localhost\SQLEXPRESS`, cambia esa parte por el nombre de tu instancia (por ejemplo `localhost`).
Todavía no hay pantallas: la API se usará desde el frontend de la Fase 4.

### Migración nueva de esta fase
`AccountSecurity`: agrega dos columnas a `AspNetUsers` (`MustChangePassword`, `LastLoginAt`). No borra ni modifica datos existentes. Reversión: `dotnet ef database update InitialCreate -p src/LBMethod.Infrastructure`.

---

## 6. Archivos

**Nuevos**
```
backend/src/LBMethod.Application/
  Abstractions/ICurrentUser.cs, Abstractions/IAppDbContext.cs
  Accounts/IAccountService.cs
  Security/ClientAccess.cs                         (aislamiento por propiedad)
backend/src/LBMethod.Infrastructure/
  DependencyInjection.cs
  Identity/AccountService.cs                       (cuentas, contraseña temporal, bitácora)
  Persistence/Migrations/20261030171906_AccountSecurity*.cs
backend/src/LBMethod.Api/
  Program.cs, appsettings.json, appsettings.Development.json, Properties/launchSettings.json
  Security/IdentitySetup.cs, Security/SecurityMiddleware.cs
  Controllers/AuthController.cs
  Controllers/Trainer/ClientAccountsController.cs
  Controllers/Portal/ProfileController.cs
  Contracts/AuthContracts.cs
  Cli/CreateTrainerCommand.cs
backend/tests/LBMethod.IntegrationTests/Api/
  ApiFactory.cs, AuthSecurityTests.cs, SessionLimitsTests.cs
docs/fase-03-autenticacion-y-seguridad.md
```

**Modificados (revisados, sin borrar funcionalidad)**
- `Identity/AppUser.cs`: dos propiedades nuevas.
- `Persistence/LBMethodDbContext.cs`: implementa `IAppDbContext`.
- `Persistence/PersistenceSetup.cs`: acepta cualquier constructor de opciones (para registrarlo en la API).
- `docs/sql/LBMethod_idempotent.sql`: script idempotente regenerado con ambas migraciones (reemplaza al de la Fase 2, que solo tenía la primera).
- `README.md`.

`appsettings.Development.json` contiene solo una cadena de conexión con autenticación de Windows (sin contraseña). Ningún secreto está en Git.

---

## 7. Pendientes y decisiones abiertas

- **Correo:** desactivado por decisión tuya. Cuando quieras activarlo, se agregan invitaciones y recuperación por correo sin cambiar la base de datos.
- **Notas privadas, objetivos y demás datos del cliente:** Fase 7.
- **Pantallas de inicio de sesión y paneles:** Fase 4 (consumirán estos endpoints).
- **D3, D6, D7, D8** siguen abiertas (archivos, hosting, videos, una o varias entrenadoras). Ninguna bloquea la Fase 4.
- Limitación conocida: la revalidación de sesión cada 60 s significa que, en el peor caso, una sesión desactivada puede responder hasta un minuto más. Se puede bajar el intervalo a costa de más consultas a la base de datos.
