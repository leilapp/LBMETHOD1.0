# LB METHOD · Instalación y ejecución en Windows

Esta guía deja LB METHOD funcionando en tu computadora con Windows y tu SQL Server local. Los comandos son para **PowerShell**.

> **Importante:** las contraseñas y cadenas de conexión **nunca** se escriben en archivos del proyecto. En desarrollo van en *User Secrets* (se guardan en tu perfil de Windows, fuera del repositorio). En producción, en variables de entorno del servidor (ver [despliegue.md](despliegue.md)).

---

## 1. Requisitos

| Programa | Versión | Para qué |
|---|---|---|
| .NET SDK | 10 | API (backend) |
| SQL Server | 2019 o posterior (Express, Developer o Standard) | Base de datos |
| Node.js | 22 LTS o posterior | Pantallas (frontend) |
| Git | cualquiera reciente | Descargar el código |

Comprueba las versiones:
```powershell
dotnet --version     # 10.x
node --version       # v22.x o posterior
sqlcmd -?            # debe responder (viene con SQL Server o con las herramientas de línea de comandos)
```

---

## 2. Descargar el código

```powershell
git clone https://github.com/leilapp/LBMETHOD1.0.git
cd LBMETHOD1.0
```

---

## 3. Base de datos

### 3.1 Respaldo previo (si ya tienes una base `LBMethod_Dev` con datos)
Antes de aplicar migraciones, haz siempre un respaldo. El procedimiento completo está en [respaldo-y-restauracion.md](respaldo-y-restauracion.md); el comando corto es:
```powershell
sqlcmd -S localhost\SQLEXPRESS -E -Q "BACKUP DATABASE [LBMethod_Dev] TO DISK = N'C:\Respaldos\LBMethod_Dev_antes_de_migrar.bak' WITH INIT, CHECKSUM"
```

### 3.2 Crear o actualizar las tablas
En la carpeta `backend`:
```powershell
cd backend
dotnet tool restore
$env:ConnectionStrings__LBMethod = "Server=localhost\SQLEXPRESS;Database=LBMethod_Dev;Trusted_Connection=True;TrustServerCertificate=True"
dotnet ef database update -p src/LBMethod.Infrastructure
```
- Si tu instancia no es `localhost\SQLEXPRESS`, cambia esa parte (por ejemplo, `localhost`).
- `Trusted_Connection=True` usa tu usuario de Windows: no hace falta contraseña.
- La variable `$env:...` solo vive en esa ventana de PowerShell.

**Alternativa sin .NET:** crea una base vacía `LBMethod_Dev` y ejecuta el script idempotente (se puede ejecutar varias veces sin duplicar nada):
```powershell
sqlcmd -S localhost\SQLEXPRESS -E -d LBMethod_Dev -I -i ..\docs\sql\LBMethod_idempotent.sql
```

La Fase 10 **no agrega migraciones**: si ya aplicaste las de la Fase 8, tu base está al día.

---

## 4. Configurar la API (una sola vez)

En la carpeta `backend`:
```powershell
# Cadena de conexión (queda en tus User Secrets, fuera del proyecto)
dotnet user-secrets set "ConnectionStrings:LBMethod" "Server=localhost\SQLEXPRESS;Database=LBMethod_Dev;Trusted_Connection=True;TrustServerCertificate=True" --project src/LBMethod.Api

# Carpeta PRIVADA para fotos, imágenes y videos (fuera de cualquier carpeta pública)
dotnet user-secrets set "Storage:LocalPath" "C:\LBMethod\archivos" --project src/LBMethod.Api

# Carpeta para las llaves de sesión: así reiniciar la API no cierra las sesiones abiertas
dotnet user-secrets set "DataProtection:KeysPath" "C:\LBMethod\llaves" --project src/LBMethod.Api
```
Si no configuras `Storage:LocalPath`, los archivos se guardan en `backend/src/LBMethod.Api/storage` (ignorada por Git).

---

## 5. Crear tu cuenta de entrenadora

No existe registro público. La cuenta se crea desde la terminal y la contraseña se escribe de forma oculta:
```powershell
dotnet run --project src/LBMethod.Api -- create-trainer tu-correo@dominio.com "Leilani"
```
La contraseña debe tener al menos 10 caracteres, con mayúscula, minúscula y número. Las cuentas de tus clientes las creas tú desde la aplicación (Clientes → Nuevo cliente).

---

## 6. Ejecutar en modo desarrollo

Dos ventanas de PowerShell:

**Ventana 1, API** (carpeta `backend`):
```powershell
dotnet run --project src/LBMethod.Api
# Queda escuchando en http://localhost:5062
```

**Ventana 2, pantallas** (carpeta `frontend`):
```powershell
cd frontend
npm install        # solo la primera vez o cuando cambien las dependencias
npm run dev
# Abre http://localhost:5173
```
En desarrollo, Vite reenvía `/api` a la API, así que todo funciona desde `http://localhost:5173`.

---

## 7. Ejecutar como en producción (un solo sitio)

La API puede servir también las pantallas compiladas, en el mismo dominio (decisión aprobada en la Fase 1):
```powershell
cd frontend
npm run build                              # genera frontend\dist
cd ..\backend
dotnet publish src/LBMethod.Api -c Release -o C:\LBMethod\app
Copy-Item -Recurse -Force ..\frontend\dist C:\LBMethod\app\wwwroot
```
La API busca las pantallas en la carpeta `wwwroot` junto a ella (o en la ruta que indiques en `Frontend:Path`). En producción **exige HTTPS**; la configuración completa está en [despliegue.md](despliegue.md).

---

## 8. Ejecutar las pruebas

**Servidor** (crean y borran su propia base temporal `LBMethod_Test_…`; no tocan `LBMethod_Dev`):
```powershell
cd backend
$env:LBMETHOD_TEST_SQL = "Server=localhost\SQLEXPRESS;Integrated Security=True;TrustServerCertificate=True"
dotnet test
```

**Pantallas:**
```powershell
cd frontend
npm test
npx tsc -b
npx oxlint
```

**Navegador real (opcional).** Necesitan la API y `npm run dev` en marcha y una cuenta de entrenadora **de prueba** (no uses tu cuenta real: estas pruebas crean clientes y rutinas). Ejemplo:
```powershell
cd frontend
npm install --no-save playwright  # solo la primera vez (no se agrega a las dependencias del proyecto)
npx playwright install chromium   # solo la primera vez
$env:LBMETHOD_E2E_EMAIL = "prueba@lbmethod.local"
$env:LBMETHOD_E2E_PASSWORD = "<contraseña de la cuenta de prueba>"
$env:LBMETHOD_E2E_TAG = (Get-Date -Format "HHmmss")
node e2e/exportaciones.cjs C:\Temp\capturas
```
- Las pruebas de PDF usan `pdftotext`, `pdfinfo` y `pdftoppm` (paquete *poppler*), y `unzip`. En Windows se instalan con `winget install oschwartz10612.Poppler` y vienen con Git Bash, respectivamente.
- El inicio de sesión admite 10 intentos por minuto: espera un minuto entre una prueba y otra.
- `LBMETHOD_E2E_BASE` permite apuntar a otra dirección (por ejemplo, la de producción local).

---

## 9. Problemas frecuentes

| Síntoma | Causa probable | Solución |
|---|---|---|
| «Falta la cadena de conexión 'ConnectionStrings:LBMethod'» | No se configuró el User Secret | Repite el paso 4 |
| `Login failed for user` | Nombre de instancia equivocado o sin permisos | Revisa `Server=...` y que tu usuario de Windows tenga acceso |
| Todas las sesiones se cierran al reiniciar la API | No se configuró `DataProtection:KeysPath` | Paso 4 |
| Error 500 al iniciar sesión en modo producción con `http://` | Producción exige HTTPS (cookies seguras) | Usa `https://` (ver despliegue) |
| «Demasiadas solicitudes» al iniciar sesión | Límite de 10 intentos por minuto | Espera un minuto |
