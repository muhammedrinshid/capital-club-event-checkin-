import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../../auth.jsx'

const NAV = [
  ['/admin', 'Events', ['admin', 'coordinator'], true],
  ['/admin/members', 'Members', ['admin']],
  ['/admin/rooms', 'Rooms', ['admin']],
  ['/admin/kiosks', 'Kiosks', ['admin']],
  ['/admin/users', 'Users', ['admin']],
  ['/admin/reports', 'Reports', ['admin']],
  ['/admin/audit', 'Activity log', ['admin']],
  ['/admin/settings', 'Settings and files', ['admin']],
]

export default function AdminLayout() {
  const { user, signOut } = useAuth()
  return (
    <div className="flex min-h-full bg-mist text-navy">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-navy p-6 text-white md:flex">
        <p className="font-display text-2xl leading-tight">Capital Club Dubai</p>
        <p className="mt-1 text-sm text-white/55">{user.role === 'admin' ? 'Club admin' : 'Event coordinator'}</p>
        <nav className="mt-8 flex-1 space-y-1">
          {NAV.filter((n) => n[2].includes(user.role)).map(([to, label, , end]) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) => `block rounded-lg px-3 py-2.5 transition ${isActive ? 'bg-white/15 text-white' : 'text-white/65 hover:bg-white/10 hover:text-white'}`}>{label}</NavLink>
          ))}
        </nav>
        <p className="truncate text-sm text-white/60">{user.full_name}</p>
        <button onClick={signOut} className="mt-2 rounded-lg bg-white/10 py-2 text-sm transition hover:bg-white/20">Sign out</button>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="flex items-center justify-between bg-navy px-4 py-3 text-white md:hidden">
          <span className="font-display text-lg">Capital Club</span>
          <button onClick={signOut} className="text-sm text-white/70">Sign out</button>
        </header>
        {user.role === 'admin' && (
          <nav className="flex gap-1 overflow-x-auto bg-navy/95 px-2 pb-2 text-sm text-white md:hidden">
            {NAV.map(([to, label, , end]) => <NavLink key={to} to={to} end={end} className={({ isActive }) => `whitespace-nowrap rounded-md px-3 py-1.5 ${isActive ? 'bg-white/20' : 'text-white/65'}`}>{label}</NavLink>)}
          </nav>
        )}
        <main className="mx-auto max-w-6xl p-5 md:p-10"><Outlet /></main>
      </div>
    </div>
  )
}
