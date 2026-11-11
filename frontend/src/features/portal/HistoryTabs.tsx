import { useLocation, useNavigate } from 'react-router-dom'
import { Tabs } from '../../components/ui'

/** «Historial» de la clienta: la misma sección con dos vistas, lista de entrenamientos y calendario. */
export function HistoryTabs() {
  const navigate = useNavigate()
  const calendar = useLocation().pathname.startsWith('/portal/calendario')
  return (
    <Tabs
      label="Vista del historial"
      value={calendar ? 'calendario' : 'lista'}
      options={[
        ['lista', 'Lista'],
        ['calendario', 'Calendario'],
      ]}
      onChange={(v) => navigate(v === 'calendario' ? '/portal/calendario' : '/portal/entrenamientos')}
    />
  )
}
