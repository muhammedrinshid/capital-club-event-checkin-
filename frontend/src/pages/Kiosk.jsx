import { useEffect, useRef, useState } from 'react'
import { api } from '../api.js'
import CheckInFlow from '../components/CheckInFlow.jsx'
import Clock from '../components/Clock.jsx'
import Logo from '../components/Logo.jsx'
import Poster from '../components/Poster.jsx'
import PosterFrame from '../components/PosterFrame.jsx'
import Promo from '../components/Promo.jsx'
import UnlockDialog from '../components/UnlockDialog.jsx'
import Reception from './Reception.jsx'

const POLL = Number(import.meta.env.VITE_KIOSK_POLL_SECONDS || 30) * 1000
const SLIDE = Number(import.meta.env.VITE_CAROUSEL_SECONDS || 8) * 1000
const time = (t) => t.slice(0, 5)

export default function Kiosk() {
  const [events, setEvents] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [offline, setOffline] = useState(false)
  const [activeId, setActiveId] = useState(null)
  const [open, setOpen] = useState(false)
  const [unlocking, setUnlocking] = useState(false)
  const [rec, setRec] = useState(null) // reception session: { token, exp }
  const itemRefs = useRef({})
  const swipe = useRef(null)

  useEffect(() => {
    let alive = true
    const load = async () => {
      try { const d = await api('/kiosk/events/'); if (alive) { setEvents(d.events); setOffline(false) } }
      catch { if (alive) setOffline(true) } finally { if (alive) setLoaded(true) }
    }
    load()
    const t = setInterval(load, POLL)
    return () => { alive = false; clearInterval(t) }
  }, [rec])

  const index = Math.max(0, events.findIndex((e) => e.id === activeId))
  const active = events[index]
  useEffect(() => { if (events.length && !events.some((e) => e.id === activeId)) setActiveId(events[0].id) }, [events])
  useEffect(() => {
    if (open || rec || events.length < 2) return
    const t = setTimeout(() => setActiveId(events[(index + 1) % events.length].id), SLIDE)
    return () => clearTimeout(t)
  }, [open, rec, events, index, activeId])
  useEffect(() => { itemRefs.current[activeId]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) }, [activeId])

  // reception session ends by itself when its token expires
  useEffect(() => {
    if (!rec) return
    const t = setTimeout(() => setRec(null), Math.max(rec.exp - Date.now(), 0))
    return () => clearTimeout(t)
  }, [rec])

  // Hidden staff entry: swipe left across the top-right corner. Guests see nothing there.
  const hotspot = !rec && !unlocking && (
    <div aria-hidden className="fixed right-0 top-0 z-[60] size-28 touch-none"
      onPointerDown={(e) => { swipe.current = { x: e.clientX, t: Date.now() }; e.currentTarget.setPointerCapture(e.pointerId) }}
      onPointerUp={(e) => { if (swipe.current && swipe.current.x - e.clientX > 140 && Date.now() - swipe.current.t < 1500) setUnlocking(true); swipe.current = null }} />
  )
  const overlays = (
    <>
      {hotspot}
      {unlocking && <UnlockDialog onClose={() => setUnlocking(false)} onUnlocked={(r) => { setUnlocking(false); setOpen(false); setRec(r) }} />}
      {rec && <Reception session={rec} onLock={() => setRec(null)} />}
    </>
  )

  if (loaded && !events.length) {
    return (
      <>
        <main className="flex h-full flex-col bg-navy p-12">
          <div className="flex items-start justify-between"><Logo className="h-16" /><Clock /></div>
          <div className="anim-rise m-auto text-center">
            <p className="font-display text-6xl">Welcome</p>
            <p className="mt-4 text-2xl text-white/65">No events are open for check-in right now.</p>
            {offline && <p className="mt-6 text-lg text-sky">Reconnecting…</p>}
          </div>
          <Promo />
        </main>
        {overlays}
      </>
    )
  }

  return (
    <>
      <main className="flex h-full bg-deep">
        <aside className="flex w-[30%] min-w-64 flex-col bg-navy">
          <header className="px-7 pb-3 pt-8">
            <p className="font-display text-3xl">Today at the club</p>
            <p className="mt-1 text-white/55">{events.length === 1 ? '1 event open for check-in' : `${events.length} events open for check-in`}</p>
          </header>
          <ul className="flex-1 space-y-3 overflow-y-auto px-5 pb-8 pt-3 [scrollbar-width:none]">
            {events.map((e) => {
              const on = e.id === activeId
              return (
                <li key={e.id} ref={(el) => (itemRefs.current[e.id] = el)}>
                  <button onClick={() => setActiveId(e.id)} aria-current={on}
                    className={`flex w-full items-center gap-4 overflow-hidden rounded-2xl p-3 text-left transition-all duration-500 ease-smooth ${on ? 'bg-white/14 ring-1 ring-sky/70' : 'bg-white/[.04] opacity-60 hover:opacity-90'}`}>
                    <div className="aspect-square w-20 shrink-0 overflow-hidden rounded-xl"><Poster event={e} /></div>
                    <div className="min-w-0">
                      <p className="truncate text-lg font-medium">{e.name}</p>
                      <p className="text-sm text-white/60">{time(e.start_time)} to {time(e.end_time)}</p>
                      <p className="truncate text-sm text-white/45">{e.room_name}</p>
                      <div className="mt-2 h-0.5 overflow-hidden rounded bg-white/10">{on && !open && !rec && events.length > 1 && <div key={activeId} className="anim-drain h-full bg-sky" style={{ animationDuration: `${SLIDE}ms` }} />}</div>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col gap-6 bg-gradient-to-br from-deep via-[#0a1d38] to-navy p-10">
          <header className="flex items-start justify-between"><Logo className="h-16" /><Clock /></header>

          <div className="relative min-h-0 flex-1">
            {events.map((e) => (
              <div key={e.id} className={`absolute inset-0 grid grid-cols-[1.1fr_1fr] gap-12 transition-all duration-700 ease-smooth ${e.id === activeId ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'}`}>
                <button onClick={() => setOpen(true)} aria-label={`Check in to ${e.name}`} tabIndex={e.id === activeId ? 0 : -1} className="min-h-0 text-left transition active:scale-[.99]"><PosterFrame event={e} /></button>
                <div className="flex min-h-0 flex-col justify-center">
                  <h1 className="font-display text-6xl leading-[1.04]">{e.name}</h1>
                  <dl className="mt-8 space-y-3 text-xl">
                    <div className="flex gap-4"><dt className="w-20 text-white/50">When</dt><dd>{time(e.start_time)} to {time(e.end_time)}</dd></div>
                    <div className="flex gap-4"><dt className="w-20 text-white/50">Room</dt><dd>{e.room_name}</dd></div>
                    {e.host_name && <div className="flex gap-4"><dt className="w-20 text-white/50">Host</dt><dd>{e.host_name}</dd></div>}
                  </dl>
                  <button onClick={() => setOpen(true)} tabIndex={e.id === activeId ? 0 : -1}
                    className="mt-10 self-start rounded-full bg-sky px-12 py-5 text-2xl font-medium text-deep shadow-xl shadow-sky/15 transition hover:bg-white active:scale-95">Check in</button>
                </div>
              </div>
            ))}
          </div>

          <Promo />
        </section>
        {offline && <p className="fixed bottom-4 left-4 z-30 rounded-full bg-deep/90 px-4 py-2 text-sm text-sky">Reconnecting…</p>}
      </main>
      {open && active && <CheckInFlow event={active} onClose={() => setOpen(false)} />}
      {overlays}
    </>
  )
}
