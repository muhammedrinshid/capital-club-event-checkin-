import { useCallback, useEffect, useState } from 'react'
import { api } from '../api.js'

export const input = 'w-full rounded-lg border border-navy/20 bg-white px-3 py-2.5 text-navy outline-none transition focus:border-sky focus:ring-4 focus:ring-sky/30'
export const btn = 'inline-flex items-center justify-center rounded-lg bg-navy px-4 py-2.5 text-sm font-medium text-white transition hover:bg-deep active:scale-[.98] disabled:opacity-50'
export const btnGhost = 'inline-flex items-center justify-center rounded-lg border border-navy/20 bg-white px-4 py-2.5 text-sm font-medium text-navy transition hover:bg-navy/5 active:scale-[.98] disabled:opacity-50'
export const btnDanger = 'inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50'

/** Turn a DRF error body into readable lines. */
export function flatErrors(data) {
  if (!data) return ['Cannot reach the server.']
  if (typeof data === 'string') return [data]
  if (data.detail) return [data.detail]
  return Object.entries(data).filter(([k]) => !['conflicts', 'suggested_rooms'].includes(k)).flatMap(([k, v]) => {
    const msgs = Array.isArray(v) ? v : typeof v === 'object' ? flatErrors(v) : [v]
    return msgs.map((m) => (k === 'non_field_errors' ? m : `${k.replaceAll('_', ' ')}: ${m}`))
  })
}

export function Errors({ list }) {
  return list?.length ? (
    <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{list.map((e, i) => <p key={i}>{e}</p>)}</div>
  ) : null
}

export function Field({ label, hint, children }) {
  return (
    <label className="block space-y-1.5 text-sm font-medium text-navy">
      {label}{children}{hint && <span className="block text-xs font-normal text-navy/55">{hint}</span>}
    </label>
  )
}

export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-deep/60 p-4 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-label={title} className={`anim-rise max-h-[92vh] w-full overflow-y-auto rounded-2xl bg-mist p-6 text-navy shadow-2xl ${wide ? 'max-w-3xl' : 'max-w-lg'}`}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-2xl">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="grid size-9 place-items-center rounded-full text-navy/60 transition hover:bg-navy/10">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-4xl text-navy">{title}</h1>
        {subtitle && <p className="mt-1 text-navy/60">{subtitle}</p>}
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

export function Table({ head, children, empty }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-navy/10 bg-white">
      <table className="w-full text-left text-sm text-navy">
        <thead className="bg-navy/5 text-navy/70"><tr>{head.map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-navy/5">{children}</tbody>
      </table>
      {empty && <p className="px-4 py-10 text-center text-navy/55">{empty}</p>}
    </div>
  )
}

export const Badge = ({ children, tone = 'sky' }) => (
  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${tone === 'sky' ? 'bg-sky/25 text-navy' : tone === 'red' ? 'bg-red-100 text-red-700' : 'bg-navy/10 text-navy/70'}`}>{children}</span>
)

export function useList(path, params = {}) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const key = path + '?' + new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null))).toString()
  const reload = useCallback(async () => {
    try { setRows(await api(key.replace(/\?$/, ''))); setError('') } catch (e) { setError(e.message) } finally { setLoading(false) }
  }, [key])
  useEffect(() => { reload() }, [reload])
  return { rows, loading, error, reload }
}

export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  a.click()
  URL.revokeObjectURL(url)
}

export const t5 = (t) => (t || '').slice(0, 5)
export const fmtDate = (d) => new Date(d + 'T00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
