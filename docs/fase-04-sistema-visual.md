# LB METHOD · Fase 4: Sistema visual y experiencia UI/UX

> Estado: **entregada, pendiente de aprobación**. Frontend en React 19 + TypeScript + Vite, conectado a la API real. Las pantallas de módulos que aún no tienen API están **marcadas como pendientes**, sin datos simulados.

Capturas de pantalla: `/mnt/project-files/fase-04/capturas/` (escritorio, tablet y celular Android).

---

## 1. Identidad visual

| Elemento | Decisión |
|---|---|
| Fondo | Negro profundo `#0B0A10`, superficies en negro violáceo (`#13111B`, `#1B1727`). |
| Marca | Violeta profundo `#3B2566` / `#5B3C94` para acciones principales y el elemento activo del menú. |
| Acento | Lila `#B9A3E3` para enlaces y foco del teclado. |
| Dorado mate | `#B89B5E`, solo en detalles: la palabra METHOD del logotipo, el borde superior de la tarjeta de inicio de sesión, la marca del menú activo y las etiquetas "Pendiente". |
| Texto | Blanco `#F4F1FA` y gris lavanda para textos secundarios (contraste legible sobre negro). |
| Tipografía | Sans-serif del sistema (Segoe UI en Windows, Roboto en Android) para lectura; serif con espaciado amplio para el logotipo. |
| Evitado | Rosa predominante, neón, degradados exagerados y tarjetas decorativas. Solo hay un degradado violeta muy suave detrás del inicio de sesión. |

Todo está definido como variables en `frontend/src/styles/tokens.css`, así que ajustar un color se hace en un solo lugar.

---

## 2. Qué pantallas existen

### Comunes
- **Iniciar sesión** (conectada a la API).
- **Crear tu contraseña**: obligatoria cuando la cuenta tiene una contraseña temporal.

### Entrenadora (menú lateral)
| Sección | Estado |
|---|---|
| Inicio | ✅ Clientes activos y total con **datos reales**. Programas asignados, próximas evaluaciones y actividad reciente: marcados "Pendiente · Fase 7/9/8" en lugar de mostrar números inventados. |
| Clientes | ✅ Lista real, crear cliente (con validación), ver contraseña temporal una sola vez con botón Copiar, restablecer contraseña, desactivar/reactivar **con confirmación**. |
| Biblioteca | Pendiente · Fase 5 |
| Rutinas | Pendiente · Fase 6 |
| Plantillas | Pendiente · Fase 6 |
| Calendario | Pendiente · Fase 9 |
| Seguimiento | Pendiente · Fase 9 |
| Configuración | ✅ Cambiar contraseña. |

### Cliente (menú lateral en escritorio, desplegable en celular)
| Sección | Estado |
|---|---|
| Inicio | ✅ Bienvenida con su nombre. Rutina vigente, próximo y último entrenamiento, semana: marcados como pendientes. |
| Mi rutina / Mis entrenamientos | Pendiente · Fase 8 |
| Mi progreso / Mi calendario | Pendiente · Fase 9 |
| Mi perfil | ✅ Sus datos reales (sin notas privadas de la entrenadora) y cambio de contraseña. |

Cada cliente solo ve el menú y las acciones de cliente; si intenta abrir una dirección de entrenadora, vuelve a su portal. La seguridad real sigue estando en la API (Fase 3), que responde 403.

---

## 3. Calidad

- **Responsive:** menú lateral fijo en escritorio; en tablet y celular (≤ 900 px) barra superior con botón de menú que abre un panel deslizable. Botones y campos de al menos 44 px de alto para usarlos con el dedo. Sin desplazamiento horizontal en celular ni tablet (verificado automáticamente).
- **Estados:** cargando (indicador animado), error (mensaje en español + botón Reintentar), vacío (explicación + acción), éxito y confirmación antes de acciones importantes.
- **Formularios accesibles:** etiquetas asociadas a cada campo, campos obligatorios marcados, mensajes de error junto al campo y anunciados a lectores de pantalla, foco visible con teclado, ventanas modales que se cierran con Esc y devuelven el foco.
- **Errores de la API** traducidos a mensajes claros ("No tienes permiso…", "Demasiados intentos. Espera un minuto…").
- **Sesión:** se guarda solo en la cookie segura del servidor; nada sensible en `localStorage`. Si la sesión vence, la aplicación vuelve a pedir inicio de sesión.
- **Mismo origen:** en desarrollo, Vite reenvía `/api` a la API, de modo que la cookie `SameSite=Strict` y la protección CSRF funcionan igual que en producción.
- Sin botones decorativos ni enlaces sin destino: cada enlace del menú lleva a una pantalla real o a una pantalla "Pendiente" explícita.

---

## 4. Pruebas

| Tipo | Resultado |
|---|---|
| Pruebas de componentes (Vitest + Testing Library) | **14 / 14** ✅ |
| Flujo completo en navegador real (Chromium) contra API real + SQL Server | **17 / 17** ✅ |
| Pruebas del backend (sin cambios de comportamiento salvo el punto 6) | **46 / 46** ✅ |
| Compilación TypeScript y build de producción | ✅ sin errores |
| Linter (oxlint) | ✅ sin advertencias |

**Componentes:** reglas de contraseña iguales a la API; fechas sin desfase de zona horaria; envío y renovación del token CSRF; mensajes de error en español; redirección sin sesión; error de login y limpieza de contraseña; contraseña temporal obligatoria; cliente redirigido fuera del área de entrenadora; menú completo de entrenadora con módulos pendientes; inicio con datos reales y sin indicadores inventados; estado vacío; estado de error con Reintentar; confirmación antes de desactivar (cancelar no llama a la API); validación del formulario y contraseña temporal al crear.

**Navegador real** (escritorio 1366×860, tablet 820×1180, Android 412×915):
1. Sin sesión → inicio de sesión. 2. Contraseña incorrecta → mensaje. 3. Entrenadora entra a su inicio. 4. Recargar conserva la sesión. 5. Crear cliente → contraseña temporal de 14 caracteres. 6. El cliente aparece en la lista (leído de SQL Server). 7. Módulo futuro marcado como pendiente. 8. Tras cerrar sesión no se vuelve al panel. 9. Cliente con contraseña temporal debe crear la suya. 10. Contraseña débil rechazada. 11. Tras cambiarla entra a su portal. 12. Su perfil muestra sus datos reales. 13. Cliente que escribe la URL de entrenadora vuelve a su portal. 14. La API le responde 403. 15–16. Sin desplazamiento horizontal en celular y tablet. 17. Sin errores en la consola (salvo los 401/403 esperados).

El script está en `frontend/e2e/flujo-completo.cjs` y usa una cuenta de entrenadora **de prueba** definida por variables de entorno.

---

## 5. Cómo verlo en tu computadora (Windows)

Requisitos: lo de la Fase 3 (API funcionando y tu cuenta de entrenadora creada) y [Node.js 22 LTS o posterior](https://nodejs.org/).

Ventana 1 (API), dentro de `backend`:
```powershell
dotnet run --project src/LBMethod.Api
```
Ventana 2 (pantallas), dentro de `frontend`:
```powershell
npm install
npm run dev
```
Abre `http://localhost:5173` en el navegador. Para verlo en tu celular Android en la misma red Wi-Fi: `npm run dev -- --host` y abre la dirección "Network" que aparezca.

Pruebas: `npm test` (componentes) y `npm run build` (compilación de producción).

---

## 6. Cambios en lo existente (revisados)

- **API `SetClientAccessAsync`:** al desactivar o reactivar el acceso, ahora también se actualiza el estado del perfil del cliente (Activo/Inactivo y fecha de desactivación), para que la pantalla de Clientes muestre el estado real. No borra nada. Se agregó la comprobación correspondiente a la prueba existente.
- `README.md`: instrucciones del frontend.
- No se modificó ninguna otra parte del backend.

## 7. Archivos nuevos

```
frontend/
  package.json, vite.config.ts, index.html, tsconfig*.json, public/favicon.svg
  src/main.tsx
  src/styles/tokens.css, src/styles/global.css
  src/api/client.ts, src/api/endpoints.ts
  src/app/App.tsx, src/app/queryClient.ts, src/app/session.tsx, src/app/guards.tsx
  src/components/ui/index.tsx                 (Botón, Campo, Aviso, Estados, Modal, Confirmación, Pendiente)
  src/layouts/AppShell.tsx, AppShell.css
  src/features/auth/AuthPages.tsx, auth.css
  src/features/trainer/TrainerPages.tsx
  src/features/portal/PortalPages.tsx
  src/lib/validation.ts, src/lib/format.ts
  src/test/setup.ts, src/test/utils.tsx, src/test/app.test.tsx
  e2e/flujo-completo.cjs
docs/fase-04-sistema-visual.md
```

Dependencias principales: React 19, React Router 7, TanStack Query 5. De desarrollo: Vite 8, TypeScript, Vitest, Testing Library. `npm audit`: 0 vulnerabilidades.

---

## 8. Pendientes y decisiones

- Los módulos marcados como pendientes se construyen en sus fases (5 a 9).
- **Producción:** servir el frontend desde la misma API (mismo dominio) se configura en la Fase 10, junto con el hosting (D6).
- **Tu revisión visual:** revisa las capturas. Si quieres ajustar tonos, tipografía (por ejemplo una fuente de marca específica) o agregar un logotipo propio en imagen, se cambia en `tokens.css` sin tocar las pantallas.
- **Idioma de la interfaz:** solo español (D9). El catálogo de ejercicios será bilingüe en la Fase 5.
