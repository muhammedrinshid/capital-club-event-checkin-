import { useState } from 'react'
import { api } from '../../api.js'
import { btn, btnGhost, Field, input, PageHeader, saveBlob, useList } from '../../components/ui.jsx'

export default function Reports() {
  const [f, setF] = useState({ date_from: '', date_to: '', room: '', host: '', coordinator: '' })
  const rooms = useList('/rooms/'), members = useList('/members/'), users = useList('/auth/users/')
  const [busy, setBusy] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  async function get(type) {
    setBusy(type)
    const q = new URLSearchParams({ ...Object.fromEntries(Object.entries(f).filter(([, v]) => v)), type })
    try { saveBlob(await api(`/events/report/?${q}`, { blob: true }), `attendance-report.${type}`) } finally { setBusy('') }
  }

  return (
    <>
      <PageHeader title="Reports" subtitle="Attendance for every event that matches the filters: name, email, company, check-in status and time." />
      <div className="grid gap-4 rounded-2xl bg-white p-6 sm:grid-cols-2">
        <Field label="From date"><input type="date" className={input} value={f.date_from} onChange={set('date_from')} /></Field>
        <Field label="To date"><input type="date" className={input} value={f.date_to} onChange={set('date_to')} /></Field>
        <Field label="Room"><select className={input} value={f.room} onChange={set('room')}><option value="">All rooms</option>{rooms.rows.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></Field>
        <Field label="Host"><select className={input} value={f.host} onChange={set('host')}><option value="">All hosts</option>{members.rows.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}</select></Field>
        <Field label="Coordinator"><select className={input} value={f.coordinator} onChange={set('coordinator')}><option value="">All coordinators</option>{users.rows.filter((u) => u.role !== 'kiosk').map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}</select></Field>
        <div className="flex items-end gap-2">
          <button className={btn} disabled={!!busy} onClick={() => get('csv')}>{busy === 'csv' ? 'Preparing…' : 'Download CSV'}</button>
          <button className={btnGhost} disabled={!!busy} onClick={() => get('pdf')}>{busy === 'pdf' ? 'Preparing…' : 'Download PDF'}</button>
        </div>
      </div>
    </>
  )
}
