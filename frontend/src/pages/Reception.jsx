import { useEffect, useState } from 'react'
import { api, ApiError } from '../api.js'
import Logo from '../components/Logo.jsx'

const t5 = (t) => t.slice(0, 5)
const today = () => new Date().toLocaleDateString('en-CA')
const shift = (iso, n) => { const d = new Date(iso + 'T00:00'); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-CA') }
const IDLE_MS = 3 * 60 * 1000
const fld = 'w-full rounded-xl border border-navy/20 bg-white px-4 py-3 text-lg outline-none focus:border-sky focus:ring-4 focus:ring-sky/30'

/** Reception mode: switch events, view other days (view-only), check in / undo, add walk-ins. */
export default function Reception({ session, onLock }) {
  const [date, setDate] = useState(today())
  const [events, setEvents] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [guests, setGuests] = useState([])
  const [q, setQ] = useState('')
  const [walkIn, setWalkIn] = useState(false)
  const [msg, setMsg] = useState('')
  const [left, setLeft] = useState(Math.round((session.exp - Date.now()) / 60000))
  const call = (path, opts = {}) => api(path, { ...opts, token: session.token }).catch((e) => { if (e instanceof ApiError && [401, 403].includes(e.status) && !/Check-in|Undo/i.test(e.message)) onLock(); throw e })

  const loadEvents = () => call(`/kiosk/events/?date=${date}`).then((d) => { setEvents(d.events); setActiveId((id) => (d.events.some((e) => e.id === id) ? id : d.events[0]?.id ?? null)) }).catch(() => {})
  const loadGuests = () => activeId ? call(`/kiosk/events/${activeId}/guests/?q=${encodeURIComponent(q.trim())}`).then(setGuests).catch(() => {}) : setGuests([])
  useEffect(() => { loadEvents() }, [date])
  useEffect(() => { const t = setTimeout(loadGuests, 200); return () => clearTimeout(t) }, [activeId, q])

  // lock after 3 quiet minutes; keep the minutes-left counter fresh
  useEffect(() => {
    let idle = setTimeout(onLock, IDLE_MS)
    const bump = () => { clearTimeout(idle); idle = setTimeout(onLock, IDLE_MS) }
    window.addEventListener('pointerdown', bump)
    const tick = setInterval(() => setLeft(Math.max(0, Math.round((session.exp - Date.now()) / 60000))), 20000)
    return () => { clearTimeout(idle); clearInterval(tick); window.removeEventListener('pointerdown', bump) }
  }, [])

  const ev = events.find((e) => e.id === activeId)
  async function act(g, what) {
    setMsg('')
    try {
      const r = await call(`/kiosk/events/${activeId}/guests/${g.id}/${what}/`, { method: 'POST' })
      setGuests((list) => list.map((x) => (x.id === g.id ? r.guest : x)))
      loadEvents()
    } catch (e) { setMsg(e.message) }
  }

  return (
    <div className="anim-open fixed inset-0 z-[65] flex flex-col bg-mist text-navy">
      <header className="flex items-center gap-6 bg-navy px-8 py-4 text-white">
        <Logo className="h-11" />
        <p className="font-display text-2xl">Reception</p>
        <div className="ml-6 flex items-center gap-2">
          <button onClick={() => setDate(shift(date, -1))} aria-label="Previous day" className="grid size-11 place-items-center rounded-full bg-white/10 transition hover:bg-white/20">‹</button>
          <button onClick={() => setDate(today())} className="min-w-44 rounded-full bg-white/10 px-5 py-2.5 text-center transition hover:bg-white/20">{date === today() ? 'Today' : new Date(date + 'T00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</button>
          <button onClick={() => setDate(shift(date, 1))} aria-label="Next day" className="grid size-11 place-items-center rounded-full bg-white/10 transition hover:bg-white/20">›</button>
        </div>
        <p className="ml-auto text-sm text-white/55">Locks in {left} min</p>
        <button onClick={onLock} className="rounded-full bg-sky px-6 py-2.5 font-medium text-deep transition hover:bg-white active:scale-95">Lock</button>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[22rem_1fr]">
        <ul className="space-y-2 overflow-y-auto border-r border-navy/10 p-4">
          {!events.length && <li className="p-4 text-navy/55">No events on this day.</li>}
          {events.map((e) => (
            <li key={e.id}><button onClick={() => setActiveId(e.id)} className={`w-full rounded-2xl p-4 text-left transition ${e.id === activeId ? 'bg-navy text-white shadow-lg' : 'bg-white hover:shadow-md'}`}>
              <p className="text-lg font-medium">{e.name}</p>
              <p className={e.id === activeId ? 'text-white/65' : 'text-navy/55'}>{t5(e.start_time)} to {t5(e.end_time)}, {e.room_name}</p>
              <p className={`mt-1 text-sm ${e.id === activeId ? 'text-sky' : 'text-navy/70'}`}>{e.checked_in_count} of {e.guest_count} checked in</p>
            </button></li>
          ))}
        </ul>

        <section className="flex min-h-0 flex-col p-6">
          {ev ? (
            <>
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <div className="mr-auto"><h2 className="font-display text-4xl">{ev.name}</h2>
                  <p className="text-navy/60">{ev.can_check_in ? 'Check-in is open.' : `View only. Check-in opens ${new Date(ev.checkin_opens_at).toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' })} and closes at ${t5(ev.end_time)}.`}</p></div>
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search guests" aria-label="Search guests" className={`${fld} max-w-xs`} />
                <button onClick={() => setWalkIn(true)} className="rounded-xl bg-navy px-6 py-3.5 font-medium text-white transition hover:bg-deep active:scale-95">Add walk-in</button>
              </div>
              {msg && <p role="alert" className="mb-3 rounded-lg bg-red-50 px-4 py-2 text-red-700">{msg}</p>}
              <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                {!guests.length && <li className="rounded-2xl bg-white p-8 text-center text-navy/55">{q ? 'No guest matches.' : 'No guests on this list yet.'}</li>}
                {guests.map((g) => (
                  <li key={g.id} className="flex items-center gap-4 rounded-2xl bg-white px-6 py-4 shadow-sm">
                    <div className="mr-auto min-w-0">
                      <p className="truncate text-xl">{g.full_name} {g.is_walk_in && <span className="ml-2 rounded-full bg-navy/10 px-2.5 py-0.5 text-xs">Walk-in</span>}</p>
                      <p className="truncate text-navy/55">{[g.company, g.title].filter(Boolean).join(', ')}</p>
                    </div>
                    {g.checked_in && <span className="text-sm text-navy/60">Checked in {new Date(g.checked_in_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>}
                    {ev.can_check_in && (g.checked_in
                      ? <button onClick={() => act(g, 'undo')} className="rounded-xl border border-navy/20 px-5 py-2.5 transition hover:bg-navy/5 active:scale-95">Undo</button>
                      : <button onClick={() => act(g, 'check-in')} className="rounded-xl bg-sky px-6 py-2.5 font-medium transition hover:bg-navy hover:text-white active:scale-95">Check in</button>)}
                  </li>
                ))}
              </ul>
            </>
          ) : <p className="m-auto text-xl text-navy/50">Choose an event.</p>}
        </section>
      </div>
      {walkIn && ev && <WalkInModal event={ev} call={call} onClose={() => setWalkIn(false)} onAdded={(g) => { setWalkIn(false); setGuests((l) => [...l, g]); loadEvents() }} onExists={(name) => { setWalkIn(false); setQ(name); setMsg('That name is already on the list.') }} />}
    </div>
  )
}

function WalkInModal({ event, call, onClose, onAdded, onExists }) {
  const [f, setF] = useState({ full_name: '', company: '', email: '', phone: '', title: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function save(e) {
    e.preventDefault(); setBusy(true); setError('')
    try { onAdded(await call(`/kiosk/events/${event.id}/walk-ins/`, { method: 'POST', body: f })) }
    catch (err) { err.status === 409 ? onExists(f.full_name) : setError(err.data?.full_name?.[0] || err.message) } finally { setBusy(false) }
  }
  const inp = (k, label, extra = {}) => <label className="block space-y-1 text-sm font-medium">{label}<input className={fld} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} {...extra} /></label>
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-deep/60 p-6 backdrop-blur-sm">
      <form onSubmit={save} className="anim-rise w-full max-w-lg space-y-4 rounded-3xl bg-mist p-8 shadow-2xl">
        <h2 className="font-display text-3xl">Add walk-in to {event.name}</h2>
        {inp('full_name', 'Full name', { required: true, autoFocus: true })}{inp('company', 'Company')}{inp('email', 'Email', { type: 'email' })}
        <div className="grid grid-cols-2 gap-3">{inp('phone', 'Phone')}{inp('title', 'Job title')}</div>
        {error && <p role="alert" className="text-red-700">{error}</p>}
        <div className="flex gap-2"><button type="button" onClick={onClose} className="flex-1 rounded-xl border border-navy/20 py-3 transition hover:bg-navy/5">Cancel</button><button disabled={busy || !f.full_name.trim()} className="flex-1 rounded-xl bg-navy py-3 font-medium text-white transition hover:bg-deep disabled:opacity-50">{busy ? 'Adding…' : 'Add to list'}</button></div>
        <p className="text-sm text-navy/55">The guest is added as a walk-in. Check them in from the list.</p>
      </form>
    </div>
  )
}
