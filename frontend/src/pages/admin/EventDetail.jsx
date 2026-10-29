import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../api.js'
import { Badge, btn, btnDanger, btnGhost, fmtDate, PageHeader, saveBlob, t5, Table, useList, input } from '../../components/ui.jsx'
import { FormModal, ImportModal } from './Crud.jsx'

const GUEST_FIELDS = [{ name: 'full_name', label: 'Full name', required: true }, { name: 'email', label: 'Email', type: 'email' }, { name: 'company', label: 'Company' }, { name: 'title', label: 'Job title' }, { name: 'phone', label: 'Phone' }]

export default function EventDetail() {
  const { id } = useParams()
  const ev = useList(`/events/${id}/`.replace(/\/$/, ''))  // single object; useList stores it in rows
  const [search, setSearch] = useState('')
  const { rows: guests, reload } = useList(`/events/${id}/guests/`, { search })
  const [modal, setModal] = useState(null)
  const e = ev.rows
  if (!e?.id) return <p className="text-navy/60">Loading…</p>

  const report = async (type) => saveBlob(await api(`/events/${id}/report/?type=${type}`, { blob: true }), `attendance-${e.date}.${type}`)

  return (
    <>
      <Link to="/admin" className="mb-3 inline-block text-sm text-navy/60 hover:text-navy">Back to events</Link>
      <PageHeader title={e.name} subtitle={`${fmtDate(e.date)}, ${t5(e.start_time)} to ${t5(e.end_time)}, ${e.room_name}${e.host_name ? `, hosted by ${e.host_name}` : ''}`}>
        <button className={btnGhost} onClick={() => report('csv')}>Report CSV</button>
        <button className={btnGhost} onClick={() => report('pdf')}>Report PDF</button>
        <button className={btnGhost} onClick={() => setModal('import')}>Upload CSV</button>
        <button className={btn} onClick={() => setModal('add')}>Add guest</button>
      </PageHeader>

      <div className="mb-5 grid grid-cols-3 gap-3 text-center">
        {[['Guests', e.guest_count], ['Checked in', e.checked_in_count], ['Walk-ins', e.walk_in_count]].map(([l, v]) => (
          <div key={l} className="rounded-2xl bg-white p-4"><p className="font-display text-4xl">{v}</p><p className="text-sm text-navy/60">{l}</p></div>
        ))}
      </div>

      <input className={`${input} mb-4 max-w-sm`} placeholder="Search guests" value={search} onChange={(x) => setSearch(x.target.value)} aria-label="Search guests" />
      <Table head={['Name', 'Company', 'Email', 'Status', '']} empty={!guests.length ? 'No guests yet. Add one or upload a CSV.' : null}>
        {guests.map((g) => (
          <tr key={g.id}>
            <td className="px-4 py-3 font-medium">{g.full_name} {g.is_walk_in && <Badge tone="grey">Walk-in</Badge>}</td>
            <td className="px-4 py-3">{g.company}</td><td className="px-4 py-3">{g.email}</td>
            <td className="px-4 py-3">{g.checked_in ? <Badge>Checked in {new Date(g.checked_in_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</Badge> : <span className="text-navy/50">Not yet</span>}</td>
            <td className="px-4 py-3 text-right"><button className={btnGhost} onClick={() => setModal(g)}>Edit</button><button className={btnDanger} onClick={async () => { if (confirm(`Remove ${g.full_name}?`)) { await api(`/events/${id}/guests/${g.id}/`, { method: 'DELETE' }); reload(); ev.reload() } }}>Remove</button></td>
          </tr>
        ))}
      </Table>

      {modal && modal !== 'import' && <FormModal title={modal === 'add' ? 'Add guest' : 'Edit guest'} path={`/events/${id}/guests/`} fields={GUEST_FIELDS} row={modal === 'add' ? null : modal}
        onClose={() => setModal(null)} onSaved={() => { setModal(null); reload(); ev.reload() }} />}
      {modal === 'import' && <ImportModal path={`/events/${id}/guests/bulk-upload/`} dryRun hint="full_name (required), email, company, title, phone" onClose={() => { setModal(null); reload(); ev.reload() }} />}
    </>
  )
}
