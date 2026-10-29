import { useEffect, useState } from 'react'
import { api, ApiError } from '../api.js'
import Logo from './Logo.jsx'
import PosterFrame from './PosterFrame.jsx'
import Promo from './Promo.jsx'

const UNDO_SECONDS = Number(import.meta.env.VITE_UNDO_SECONDS || 5)
const IDLE_MS = 45000
const time = (t) => t.slice(0, 5)
const detail = (g, fields) => (fields || []).map((f) => g[f]).filter(Boolean).join(', ')
const secondary = 'rounded-full border border-navy/20 bg-white px-9 py-4 text-xl text-navy transition hover:bg-navy/5 active:scale-95'
const primary = 'rounded-full bg-navy px-12 py-4 text-xl font-medium text-white transition hover:bg-deep active:scale-95 disabled:opacity-60'

/** Full-screen guest flow: welcome -> search -> confirm -> thanks -> welcome. */
export default function CheckInFlow({ event, onClose }) {
  const [step, setStep] = useState('home')
  const [q, setQ] = useState('')
  const [results, setResults] = useState(null)
  const [picked, setPicked] = useState(null)
  const [done, setDone] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [undoOpen, setUndoOpen] = useState(true)
  const base = `/kiosk/events/${event.id}/guests/`

  useEffect(() => {
    if (step !== 'search' && step !== 'confirm') return
    const t = setTimeout(reset, IDLE_MS)
    return () => clearTimeout(t)
  }, [step, q, picked])

  useEffect(() => {
    if (step !== 'search') return
    const term = q.trim()
    if (term.length < 2 && !(event.show_guest_list && term.length === 0)) { setResults(null); return }
    let stale = false
    const t = setTimeout(async () => {
      try { const d = await api(`${base}?q=${encodeURIComponent(term)}`); if (!stale) setResults(d) } catch { if (!stale) setResults([]) }
    }, 250)
    return () => { stale = true; clearTimeout(t) }
  }, [q, step])

  useEffect(() => {
    if (step !== 'thanks') return
    setUndoOpen(true)
    const a = setTimeout(() => setUndoOpen(false), UNDO_SECONDS * 1000)
    const b = setTimeout(reset, (UNDO_SECONDS + 2) * 1000)
    return () => { clearTimeout(a); clearTimeout(b) }
  }, [step])

  function reset() { setStep('home'); setQ(''); setResults(null); setPicked(null); setDone(null); setError('') }

  async function confirm() {
    setBusy(true); setError('')
    try {
      const r = await api(`${base}${picked.id}/check-in/`, { method: 'POST' })
      setDone({ guest: r.guest, already: r.already_checked_in }); setStep('thanks')
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Cannot reach the server. Please ask reception.') } finally { setBusy(false) }
  }
  async function undo() {
    setUndoOpen(false)
    try { await api(`${base}${done.guest.id}/undo/`, { method: 'POST' }) } catch { /* grace period passed */ }
    reset()
  }

  const notFound = results !== null && results.length === 0 && q.trim().length >= 2

  return (
    <div className="anim-open fixed inset-0 z-50 flex flex-col bg-navy">
      <header className="flex items-center justify-between px-12 pb-4 pt-7">
        <Logo className="h-14" />
        {step !== 'thanks' && <button onClick={step === 'home' ? onClose : reset} className="rounded-full bg-white/10 px-6 py-3 text-lg transition hover:bg-white/20 active:scale-95">{step === 'home' ? 'Back to events' : 'Start over'}</button>}
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,34fr)_minmax(0,66fr)] gap-10 px-12 py-4">
        <div className="flex min-h-0 flex-col gap-5">
          <div className="min-h-0 flex-1"><PosterFrame event={event} /></div>
          <div><p className="font-display text-3xl leading-tight">{event.name}</p><p className="mt-1 text-white/60">{event.room_name}, {time(event.start_time)} to {time(event.end_time)}</p></div>
        </div>

        <div key={step} className="anim-rise flex min-h-0 flex-col rounded-[2rem] bg-mist p-12 text-navy">
          {step === 'home' && (
            <div className="m-auto max-w-xl text-center">
              <p className="text-2xl text-navy/60">Welcome to</p>
              <h1 className="mt-2 font-display text-6xl leading-[1.05]">{event.name}</h1>
              {event.host_name && <p className="mt-4 text-2xl text-navy/65">Hosted by {event.host_name}</p>}
              <button onClick={() => setStep('search')} className="mt-12 rounded-full bg-navy px-16 py-6 text-3xl font-medium text-white shadow-xl shadow-navy/20 transition hover:bg-deep active:scale-95">Check in</button>
            </div>
          )}

          {step === 'search' && (
            <>
              <h2 className="font-display text-5xl">What is your name?</h2>
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Start typing your name"
                className="mt-6 w-full rounded-2xl border border-navy/20 bg-white px-7 py-5 text-3xl outline-none transition placeholder:text-navy/35 focus:border-sky focus:ring-4 focus:ring-sky/30" />
              <ul className="mt-5 min-h-0 flex-1 space-y-3 overflow-y-auto pb-2">
                {results?.map((g) => (
                  <li key={g.id}>
                    <button onClick={() => { setPicked(g); setStep('confirm') }} className="flex w-full items-center justify-between rounded-2xl bg-white px-7 py-5 text-left shadow-sm transition hover:shadow-md active:scale-[.99]">
                      <span><span className="block text-3xl">{g.full_name}</span>{detail(g, event.kiosk_display_fields) && <span className="mt-1 block text-lg text-navy/55">{detail(g, event.kiosk_display_fields)}</span>}</span>
                      {g.checked_in && <span className="rounded-full bg-sky/30 px-4 py-1 text-sm">Checked in</span>}
                    </button>
                  </li>
                ))}
                {notFound && <li className="rounded-2xl bg-white px-7 py-8 text-2xl text-navy/80">We could not find that name. Please ask reception.</li>}
              </ul>
            </>
          )}

          {step === 'confirm' && picked && (
            <div className="m-auto max-w-2xl text-center">
              <p className="text-2xl text-navy/60">Check in as</p>
              <h2 className="mt-3 font-display text-7xl leading-tight">{picked.full_name}</h2>
              {detail(picked, event.kiosk_display_fields) && <p className="mt-3 text-2xl text-navy/55">{detail(picked, event.kiosk_display_fields)}</p>}
              {error && <p role="alert" className="mt-6 text-xl text-red-700">{error}</p>}
              <div className="mt-12 flex justify-center gap-4">
                <button onClick={() => setStep('search')} className={secondary}>Not me</button>
                <button onClick={confirm} disabled={busy} className={primary}>{busy ? 'Checking in…' : 'Confirm'}</button>
              </div>
            </div>
          )}

          {step === 'thanks' && done && (
            <div className="m-auto max-w-2xl text-center">
              <div className="mx-auto grid size-24 place-items-center rounded-full bg-navy text-5xl text-sky">✓</div>
              <h2 className="mt-8 font-display text-6xl leading-tight">Thank you, {done.guest.full_name.split(' ')[0]}</h2>
              <p className="mt-4 text-2xl text-navy/65">{done.already ? 'You were already checked in.' : `Welcome to ${event.name}.`}</p>
              {undoOpen && !done.already && (
                <div className="mx-auto mt-10 w-64">
                  <button onClick={undo} className={`${secondary} w-full`}>Undo check-in</button>
                  <div className="mt-3 h-1 overflow-hidden rounded bg-navy/10"><div className="anim-drain h-full bg-navy" style={{ animationDuration: `${UNDO_SECONDS}s` }} /></div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <footer className="px-12 pb-7 pt-3"><Promo /></footer>
    </div>
  )
}
