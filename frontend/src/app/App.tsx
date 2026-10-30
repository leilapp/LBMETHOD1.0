import { ClientDetailPage, ClientProfileFormPage } from '../features/clients/ClientPages'
import { useState } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell, type NavItem } from '../layouts/AppShell'
import { ChangePasswordPage, LoginPage } from '../features/auth/AuthPages'
import { ClientsPage, TrainerDashboardPage, TrainerSettingsPage } from '../features/trainer/TrainerPages'
import { PortalHomePage, PortalProfilePage } from '../features/portal/PortalPages'
import { PortalRoutinePage, PortalSessionsPage, SessionPage } from '../features/portal/TrainingPages'
import { LibraryPage } from '../features/library/LibraryPage'
import { EditExercisePage, NewExercisePage } from '../features/library/ExerciseFormPage'
import { ExerciseDetailPage } from '../features/library/ExerciseDetailPage'
import { ImportExportPage } from '../features/library/ImportExportPage'
import { RoutineListPage, RoutinePage } from '../features/routines/RoutinesPages'
import { RoutineBuilderPage } from '../features/routines/RoutineBuilderPage'
import { ClientTrackingPage, PortalProgressPage, TrackingOverviewPage, TrainerSessionPage } from '../features/tracking/TrackingPages'
import { PortalCalendarPage, TrainerCalendarPage } from '../features/tracking/CalendarPages'
import { RedirectHome, RequireRole } from './guards'
import { createQueryClient } from './queryClient'

const trainerNav: NavItem[] = [
  { to: '/entrenadora', label: 'Inicio', end: true },
  { to: '/entrenadora/clientes', label: 'Clientes' },
  { to: '/entrenadora/biblioteca', label: 'Biblioteca' },
  { to: '/entrenadora/rutinas', label: 'Rutinas' },
  { to: '/entrenadora/plantillas', label: 'Plantillas' },
  { to: '/entrenadora/calendario', label: 'Calendario' },
  { to: '/entrenadora/seguimiento', label: 'Seguimiento' },
  { to: '/entrenadora/configuracion', label: 'Configuración' },
]

const clientNav: NavItem[] = [
  { to: '/portal', label: 'Inicio', end: true },
  { to: '/portal/rutina', label: 'Mi rutina' },
  { to: '/portal/entrenamientos', label: 'Mis entrenamientos' },
  { to: '/portal/progreso', label: 'Mi progreso' },
  { to: '/portal/calendario', label: 'Mi calendario' },
  { to: '/portal/perfil', label: 'Mi perfil' },
]

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RedirectHome />} />
      <Route path="/iniciar-sesion" element={<LoginPage />} />
      <Route path="/cambiar-contrasena" element={<ChangePasswordPage />} />

      <Route element={<RequireRole role="TRAINER" />}>
        <Route path="/entrenadora" element={<AppShell nav={trainerNav} areaLabel="Entrenadora" />}>
          <Route index element={<TrainerDashboardPage />} />
          <Route path="clientes" element={<ClientsPage />} />
          <Route path="clientes/:id" element={<ClientDetailPage />} />
          <Route path="clientes/:id/editar" element={<ClientProfileFormPage />} />
          <Route path="biblioteca" element={<LibraryPage />} />
          <Route path="biblioteca/nuevo" element={<NewExercisePage />} />
          <Route path="biblioteca/importar" element={<ImportExportPage />} />
          <Route path="biblioteca/ejercicios/:id" element={<ExerciseDetailPage />} />
          <Route path="biblioteca/ejercicios/:id/editar" element={<EditExercisePage />} />
          <Route path="rutinas" element={<RoutineListPage section="rutinas" />} />
          <Route path="rutinas/:id" element={<RoutinePage section="rutinas" />} />
          <Route path="rutinas/:id/editar" element={<RoutineBuilderPage section="rutinas" />} />
          <Route path="plantillas" element={<RoutineListPage section="plantillas" />} />
          <Route path="plantillas/:id" element={<RoutinePage section="plantillas" />} />
          <Route path="plantillas/:id/editar" element={<RoutineBuilderPage section="plantillas" />} />
          <Route path="clientes/:id/seguimiento" element={<ClientTrackingPage />} />
          <Route path="clientes/:id/entrenamientos/:sid" element={<TrainerSessionPage />} />
          <Route path="calendario" element={<TrainerCalendarPage />} />
          <Route path="seguimiento" element={<TrackingOverviewPage />} />
          <Route path="configuracion" element={<TrainerSettingsPage />} />
        </Route>
      </Route>

      <Route element={<RequireRole role="CLIENT" />}>
        <Route path="/portal" element={<AppShell nav={clientNav} areaLabel="Mi espacio" />}>
          <Route index element={<PortalHomePage />} />
          <Route path="rutina" element={<PortalRoutinePage />} />
          <Route path="entrenamientos" element={<PortalSessionsPage />} />
          <Route path="entrenamiento/:id" element={<SessionPage />} />
          <Route path="progreso" element={<PortalProgressPage />} />
          <Route path="calendario" element={<PortalCalendarPage />} />
          <Route path="perfil" element={<PortalProfilePage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  const [queryClient] = useState(createQueryClient)
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
