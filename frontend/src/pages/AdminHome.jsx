import { useAuth } from '../auth.jsx'

export default function AdminHome() {
  const { user, signOut } = useAuth()
  return (
    <main className="min-h-full grid place-items-center bg-mist text-navy p-8">
      <div className="max-w-md text-center">
        <h1 className="font-display text-4xl">Welcome, {user.full_name}</h1>
        <p className="mt-3 text-navy/70">The {user.role} dashboard is the next screen to build.</p>
        <button onClick={signOut} className="mt-8 rounded-full bg-navy px-6 py-3 text-white transition hover:bg-deep">Sign out</button>
      </div>
    </main>
  )
}
