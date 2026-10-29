import { useState } from 'react'
import { Badge, input, PageHeader, Table, useList } from '../../components/ui.jsx'

const ACTIONS = ['check_in', 'undo_check_in', 'walkin_added', 'guest_added', 'guest_bulk_import', 'guest_removed', 'event_created', 'event_updated', 'event_cancelled', 'reception_unlock', 'reception_unlock_failed', 'login', 'login_failed']

export default function Audit() {
  const [action, setAction] = useState('')
  const [search, setSearch] = useState('')
  const { rows } = useList('/audit/', { action, search, limit: 200 })
  return (
    <>
      <PageHeader title="Activity log" subtitle="Check-ins, undos, walk-ins, imports and sign-ins. The latest 200 entries.">
        <input className={`${input} w-52`} placeholder="Guest name" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search guest name" />
        <select className={`${input} w-52`} value={action} onChange={(e) => setAction(e.target.value)} aria-label="Filter by action"><option value="">All actions</option>{ACTIONS.map((a) => <option key={a} value={a}>{a.replaceAll('_', ' ')}</option>)}</select>
      </PageHeader>
      <Table head={['Time', 'Action', 'Guest', 'Event', 'By']} empty={!rows.length ? 'No activity yet.' : null}>
        {rows.map((r) => (
          <tr key={r.id}>
            <td className="whitespace-nowrap px-4 py-3">{new Date(r.created_at).toLocaleString('en-GB')}</td>
            <td className="px-4 py-3"><Badge tone={r.action.includes('failed') ? 'red' : 'sky'}>{r.action.replaceAll('_', ' ')}</Badge></td>
            <td className="px-4 py-3">{r.guest_name}</td><td className="px-4 py-3">{r.event_name}</td><td className="px-4 py-3">{r.user_email}</td>
          </tr>
        ))}
      </Table>
    </>
  )
}
