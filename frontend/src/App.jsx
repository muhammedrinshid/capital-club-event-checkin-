import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth.jsx'
import Login from './pages/Login.jsx'
import Kiosk from './pages/Kiosk.jsx'
import AdminLayout from './pages/admin/AdminLayout.jsx'
import Events from './pages/admin/Events.jsx'
import EventDetail from './pages/admin/EventDetail.jsx'
import { Kiosks, Members, Rooms, Users } from './pages/admin/Crud.jsx'
import Reports from './pages/admin/Reports.jsx'
import Audit from './pages/admin/Audit.jsx'
import Settings from './pages/admin/Settings.jsx'

const home = (role) => (role === 'kiosk' ? '/kiosk' : '/admin')

function Guard({ role, children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (role && !role.includes(user.role)) return <Navigate to={home(user.role)} replace />
  return children
}

export default function App() {
  const { user } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={home(user.role)} replace /> : <Login />} />
      <Route path="/kiosk" element={<Guard role={['kiosk']}><Kiosk /></Guard>} />
      <Route path="/admin" element={<Guard role={['admin', 'coordinator']}><AdminLayout /></Guard>}>
        <Route index element={<Events />} />
        <Route path="events/:id" element={<EventDetail />} />
        <Route path="members" element={<Guard role={['admin']}><Members /></Guard>} />
        <Route path="rooms" element={<Guard role={['admin']}><Rooms /></Guard>} />
        <Route path="kiosks" element={<Guard role={['admin']}><Kiosks /></Guard>} />
        <Route path="users" element={<Guard role={['admin']}><Users /></Guard>} />
        <Route path="reports" element={<Guard role={['admin']}><Reports /></Guard>} />
        <Route path="audit" element={<Guard role={['admin']}><Audit /></Guard>} />
        <Route path="settings" element={<Guard role={['admin']}><Settings /></Guard>} />
      </Route>
      <Route path="*" element={<Navigate to={user ? home(user.role) : '/login'} replace />} />
    </Routes>
  )
}
