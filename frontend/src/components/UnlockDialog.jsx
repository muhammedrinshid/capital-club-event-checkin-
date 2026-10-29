import { useState } from 'react'
import { api, ApiError } from '../api.js'

/** Staff password prompt (the same password as this kiosk's login). */
export default function UnlockDialog({ onUnlocked, onClose }) {
  const [pw, setPw] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('')
    try {
      const r = await api('/kiosk/unlock/', { method: 'POST', body: { password: pw } })
      onUnlocked({ token: r.reception_access, exp: Date.now() + r.expires_in * 1000 })
    } catch (err) {
      setError(err instanceof ApiError && err.status === 429 ? 'Too many attempts. Wait a minute.' : 'Incorrect password.')
      setPw('')
    } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-deep/80 p-6 backdrop-blur-md" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form onSubmit={submit} className="anim-rise w-full max-w-sm space-y-4 rounded-3xl bg-mist p-8 text-navy shadow-2xl">
        <h2 className="font-display text-3xl">Staff access</h2>
        <input autoFocus type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Password" autoComplete="current-password"
          className="w-full rounded-xl border border-navy/20 bg-white px-4 py-3.5 text-lg outline-none focus:border-sky focus:ring-4 focus:ring-sky/30" />
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-navy/20 py-3 transition hover:bg-navy/5">Cancel</button>
          <button disabled={busy || !pw} className="flex-1 rounded-xl bg-navy py-3 font-medium text-white transition hover:bg-deep disabled:opacity-50">{busy ? 'Checking…' : 'Unlock'}</button>
        </div>
      </form>
    </div>
  )
}
