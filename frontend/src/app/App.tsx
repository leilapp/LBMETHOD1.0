import { ClientDetailPage, ClientProfileFormPage } from '../features/clients/ClientPages'
import { useState } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell, type NavItem } from '../layouts/AppShell'
import { ChangePasswordPage, LoginPage, RecoverPasswordPage } from '../features/auth/AuthPages'
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
import {
  Activity,
  CalendarDays,
  ClipboardList,
  Dumbbell,
  History,
  House,
  LayoutTemplate,
  Settings,
  TrendingUp,
  UserRound,
  Users,
} from 'lucide-react'

// «primary»: va en la barra inferior del teléfono (máximo 4); el resto queda en «Más».
const trainerNav: NavItem[] = [
  { to: '/entrenadora', label: 'Inicio', icon: House, primary: true, end: true },
  { to: '/entrenadora/clientes', label: 'Clientes', icon: Users, primary: true },
  { to: '/entrenadora/biblioteca', label: 'Biblioteca', icon: Dumbbell, primary: true },
  { to: '/entrenadora/rutinas', label: 'Rutinas', icon: ClipboardList, primary: true },
  { to: '/entrenadora/plantillas', label: 'Plantillas', icon: LayoutTemplate },
  { to: '/entrenadora/calendario', label: 'Calendario', icon: CalendarDays },
  { to: '/entrenadora/seguimiento', label: 'Seguimiento', icon: Activity },
  { to: '/entrenadora/configuracion', label: 'Configuración', icon: Settings },
]

const clientNav: NavItem[] = [
  { to: '/portal', label: 'Inicio', icon: House, primary: true, end: true },
  { to: '/portal/rutina', label: 'Mi rutina', short: 'Rutina', icon: Dumbbell, primary: true },
  { to: '/portal/entrenamientos', label: 'Mis entrenamientos', short: 'Historial', icon: History, primary: true },
  { to: '/portal/progreso', label: 'Mi progreso', short: 'Progreso', icon: TrendingUp, primary: true },
  { to: '/portal/calendario', label: 'Mi calendario', icon: CalendarDays },
  { to: '/portal/perfil', label: 'Mi perfil', icon: UserRound },
]

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RedirectHome />} />
      <Route path="/iniciar-sesion" element={<LoginPage />} />
      <Route path="/cambiar-contrasena" element={<ChangePasswordPage />} />
      <Route path="/recuperar-contrasena" element={<RecoverPasswordPage />} />

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
