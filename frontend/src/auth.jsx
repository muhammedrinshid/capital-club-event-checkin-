import { createContext, useCallback, useContext, useState } from 'react'
import { api, session } from './api.js'

const Ctx = createContext(null)
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => session.get()?.user || null)

  const signIn = useCallback((data) => {
    session.set({ access: data.access, refresh: data.refresh, user: data.user })
    setUser(data.user)
  }, [])

  const signOut = useCallback(async () => {
    const s = session.get()
    try { if (s?.refresh) await api('/auth/logout/', { method: 'POST', body: { refresh: s.refresh } }) } catch { /* ignore */ }
    session.clear()
    setUser(null)
  }, [])

  return <Ctx.Provider value={{ user, signIn, signOut }}>{children}</Ctx.Provider>
}
