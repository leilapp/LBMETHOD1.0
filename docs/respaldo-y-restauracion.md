# LB METHOD · Respaldo y restauración

La información de LB METHOD vive en **tres lugares**. Un respaldo completo los incluye a los tres, tomados el mismo día:

| Qué | Dónde | Qué contiene |
|---|---|---|
| Base de datos SQL Server | `LBMethod_Dev` (o el nombre de producción) | Cuentas, clientes, ejercicios, rutinas y versiones, asignaciones, entrenamientos registrados, evaluaciones, calendario y bitácora de auditoría |
| Carpeta de archivos privados | `Storage:LocalPath` (por ejemplo `C:\LBMethod\archivos`) | Fotos de progreso, imágenes y videos de ejercicios |
| Carpeta de llaves de sesión | `DataProtection:KeysPath` (por ejemplo `C:\LBMethod\llaves`) | Llaves que firman las sesiones. Sin ellas, al restaurar todos deben volver a iniciar sesión (no se pierde ningún dato) |

> Los respaldos contienen datos personales y fotos de tus clientes. Guárdalos en un lugar privado (un disco externo o una nube con acceso solo tuyo) y **nunca** en el repositorio de Git.

Los ejemplos usan `localhost\SQLEXPRESS` y la autenticación de Windows (`-E`). Cambia la instancia si la tuya es otra. La carpeta `C:\Respaldos` debe existir y la cuenta del servicio de SQL Server debe poder escribir en ella.

---

## 1. Respaldo

### 1.1 Base de datos
```powershell
$fecha = Get-Date -Format "yyyy-MM-dd_HHmm"
sqlcmd -S localhost\SQLEXPRESS -E -b -Q "BACKUP DATABASE [LBMethod_Dev] TO DISK = N'C:\Respaldos\LBMethod_$fecha.bak' WITH INIT, CHECKSUM, COMPRESSION"
```
- `CHECKSUM` comprueba las páginas al escribir.
- SQL Server Express no admite `COMPRESSION`: si te marca error, quita `, COMPRESSION`.

**Comprobar que el respaldo se puede leer** (no restaura nada):
```powershell
sqlcmd -S localhost\SQLEXPRESS -E -b -Q "RESTORE VERIFYONLY FROM DISK = N'C:\Respaldos\LBMethod_$fecha.bak' WITH CHECKSUM"
```
Debe responder «The backup set on file 1 is valid».

### 1.2 Archivos privados y llaves
```powershell
Compress-Archive -Path C:\LBMethod\archivos -DestinationPath "C:\Respaldos\LBMethod_archivos_$fecha.zip"
Compress-Archive -Path C:\LBMethod\llaves   -DestinationPath "C:\Respaldos\LBMethod_llaves_$fecha.zip"
```

### 1.3 Antes de cada migración
Las migraciones cambian la estructura de la base. **Siempre** respalda antes (paso 1.1) y conserva ese archivo hasta comprobar que todo funciona después de migrar.

### 1.4 Respaldo automático (recomendado)
Con el Programador de tareas de Windows puedes ejecutar los pasos 1.1 y 1.2 cada noche. Guarda los comandos en un archivo `respaldo.ps1` y crea una tarea diaria que ejecute:
```
powershell.exe -ExecutionPolicy Bypass -File C:\LBMethod\respaldo.ps1
```
Conserva al menos los últimos 7 respaldos y copia uno por semana fuera de la computadora.

---

## 2. Restauración

> ⚠️ Restaurar **reemplaza** la base actual con la del respaldo. Todo lo registrado después de esa fecha se pierde. Si dudas, restaura primero con otro nombre (sección 2.3) para revisar.

### 2.1 Detener la API
Cierra la ventana donde corre la API (o detén el sitio en IIS) para que nadie escriba mientras restauras.

### 2.2 Restaurar la base
```powershell
sqlcmd -S localhost\SQLEXPRESS -E -b -Q "ALTER DATABASE [LBMethod_Dev] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; RESTORE DATABASE [LBMethod_Dev] FROM DISK = N'C:\Respaldos\LBMethod_2026-10-31_2200.bak' WITH REPLACE, CHECKSUM; ALTER DATABASE [LBMethod_Dev] SET MULTI_USER;"
```
Si la base no existe (por ejemplo, en una computadora nueva), basta con:
```powershell
sqlcmd -S localhost\SQLEXPRESS -E -b -Q "RESTORE DATABASE [LBMethod_Dev] FROM DISK = N'C:\Respaldos\LBMethod_2026-10-31_2200.bak' WITH CHECKSUM"
```
Si las carpetas de datos de SQL Server son distintas en la computadora nueva, consulta los nombres lógicos con `RESTORE FILELISTONLY FROM DISK = N'...'` y agrega `MOVE 'nombre_logico' TO 'C:\ruta\archivo.mdf'` para cada archivo.

### 2.3 Restaurar con otro nombre, para revisar sin tocar la base actual
```powershell
sqlcmd -S localhost\SQLEXPRESS -E -b -Q "RESTORE FILELISTONLY FROM DISK = N'C:\Respaldos\LBMethod_2026-10-31_2200.bak'"
# Usa los nombres lógicos que aparecen (columna LogicalName):
sqlcmd -S localhost\SQLEXPRESS -E -b -Q "RESTORE DATABASE [LBMethod_Revision] FROM DISK = N'C:\Respaldos\LBMethod_2026-10-31_2200.bak' WITH MOVE 'LBMethod_Dev' TO 'C:\Respaldos\LBMethod_Revision.mdf', MOVE 'LBMethod_Dev_log' TO 'C:\Respaldos\LBMethod_Revision_log.ldf'"
```

### 2.4 Restaurar archivos y llaves
```powershell
Expand-Archive "C:\Respaldos\LBMethod_archivos_2026-10-31_2200.zip" -DestinationPath C:\LBMethod -Force
Expand-Archive "C:\Respaldos\LBMethod_llaves_2026-10-31_2200.zip"   -DestinationPath C:\LBMethod -Force
```
Usa los archivos del **mismo día** que la base: la base guarda qué foto o video corresponde a cada registro.

### 2.5 Volver a arrancar y comprobar
1. Arranca la API.
2. Inicia sesión como entrenadora y revisa: lista de clientes, una rutina con sus versiones, el seguimiento de un cliente (con una foto) y el calendario.
3. Si alguien pierde la sesión, solo debe volver a iniciarla.

---

## 3. Cómo se probó

En el entorno de desarrollo (SQL Server 2022 en contenedor):
- Se respaldó la base antes de la migración de la Fase 8 (`LBMethod_Dev_pre_fase8.bak`).
- En la Fase 10 se reinició por completo la API y el servidor SQL, y la prueba `e2e/persistencia.cjs` comprobó que clientes, evaluaciones, fotos (comparando su huella SHA‑256), rutinas y calendario siguieron iguales: **5 de 5 correctas**.
- Al finalizar la Fase 10 se ejecutaron los comandos de esta guía contra la base de desarrollo:
  - `BACKUP DATABASE … WITH CHECKSUM, COMPRESSION`: correcto (1 578 páginas).
  - `RESTORE VERIFYONLY`: «The backup set on file 1 is valid».
  - `RESTORE FILELISTONLY`: nombres lógicos `LBMethod_Dev` y `LBMethod_Dev_log`, los mismos de la sección 2.3.
  - Restauración con otro nombre (`LBMethod_Revision`, sección 2.3): correcta, con sus 35 tablas y los datos (por ejemplo 58 clientes, 76 ejercicios, 64 versiones de rutina, 426 registros de auditoría). Después se borró esa copia de revisión; la base original no se tocó.
- Los comandos se ejecutaron en Linux con `sqlcmd`; en tu Windows son los mismos, cambiando solo las rutas de los archivos.
